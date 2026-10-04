import crypto from 'crypto';
import { env } from '../config/environment';
import { Otp } from '../models';
import { normalizePhoneNumber } from '../utils/phone';

export interface ISmsProvider {
  sendSms(phoneNumber: string, message: string): Promise<boolean>;
}

export class MockSmsProvider implements ISmsProvider {
  async sendSms(phoneNumber: string, message: string): Promise<boolean> {
    if (env.NODE_ENV === 'production') {
      throw new Error('Fatal Security Violation: MockSmsProvider invoked in production environment.');
    }
    console.log(`\n================== [MOCK SMS PROVIDER (DEV ONLY)] ==================`);
    console.log(`[SMS to ${phoneNumber}]: ${message}`);
    console.log(`====================================================================\n`);
    return true;
  }
}

export class TwilioSmsProvider implements ISmsProvider {
  async sendSms(phoneNumber: string, message: string): Promise<boolean> {
    if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_PHONE_NUMBER) {
      console.warn('[TwilioSmsProvider] Twilio credentials missing. SMS skipped.');
      return false;
    }
    try {
      // Direct REST call to Twilio Messages API (avoiding heavy external sdk requirement)
      const auth = Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64');
      const params = new URLSearchParams({
        To: phoneNumber,
        From: env.TWILIO_PHONE_NUMBER,
        Body: message
      });
      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: params.toString()
        }
      );
      if (!response.ok) {
        const errorData = await response.text();
        console.error('[TwilioSmsProvider] Twilio API error:', errorData);
        return false;
      }
      return true;
    } catch (err: any) {
      console.error('[TwilioSmsProvider] Failed to send SMS via Twilio:', err.message);
      return false;
    }
  }
}

export class Msg91SmsProvider implements ISmsProvider {
  async sendSms(phoneNumber: string, message: string): Promise<boolean> {
    if (!env.MSG91_AUTH_KEY || !env.MSG91_TEMPLATE_ID) {
      console.warn('[Msg91SmsProvider] MSG91 credentials missing. DLT SMS skipped.');
      return false;
    }
    try {
      const cleanNumber = phoneNumber.replace('+', '');
      const response = await fetch('https://control.msg91.com/api/v5/otp', {
        method: 'POST',
        headers: {
          authkey: env.MSG91_AUTH_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          template_id: env.MSG91_TEMPLATE_ID,
          mobile: cleanNumber
        })
      });
      return response.ok;
    } catch (err: any) {
      console.error('[Msg91SmsProvider] Failed to send SMS via MSG91:', err.message);
      return false;
    }
  }
}

export class Fast2SmsProvider implements ISmsProvider {
  async sendSms(phoneNumber: string, message: string): Promise<boolean> {
    if (!env.FAST2SMS_API_KEY) {
      console.warn('[Fast2SmsProvider] Fast2SMS API key missing. SMS skipped.');
      return false;
    }
    try {
      const nationalNumber = phoneNumber.replace('+91', '').trim();
      const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
        method: 'POST',
        headers: {
          authorization: env.FAST2SMS_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          route: 'q',
          message,
          numbers: nationalNumber
        })
      });
      return response.ok;
    } catch (err: any) {
      console.error('[Fast2SmsProvider] Failed to send SMS via Fast2SMS:', err.message);
      return false;
    }
  }
}

export class OtpService {
  private static getProvider(): ISmsProvider {
    if (env.SMS_PROVIDER === 'twilio') return new TwilioSmsProvider();
    if (env.SMS_PROVIDER === 'msg91') return new Msg91SmsProvider();
    if (env.SMS_PROVIDER === 'fast2sms') return new Fast2SmsProvider();
    return new MockSmsProvider();
  }

  static generateOtpCode(): string {
    if (env.MOCK_OTP_ENABLED && env.NODE_ENV !== 'production') {
      return env.MOCK_OTP_CODE;
    }
    // Cryptographically secure 6-digit random code
    return crypto.randomInt(100000, 1000000).toString();
  }

  /**
   * Constant-time SHA-256 hash comparison to protect against timing attacks.
   */
  private static timingSafeVerify(input: string, targetHash: string): boolean {
    const inputHash = crypto.createHash('sha256').update(input).digest('hex');
    const inputBuf = Buffer.from(inputHash, 'utf8');
    const targetBuf = Buffer.from(targetHash, 'utf8');

    if (inputBuf.length !== targetBuf.length) {
      return false;
    }
    return crypto.timingSafeEqual(inputBuf, targetBuf);
  }

  static async requestOtp(
    rawPhoneNumber: string
  ): Promise<{ success: boolean; message: string; mockOtp?: string }> {
    const phoneNumber = normalizePhoneNumber(rawPhoneNumber);

    const now = new Date();
    const existingOtp = await Otp.findOne({ phoneNumber });

    if (existingOtp) {
      // 1. Enforce 60-second resend cooldown
      const secondsSinceLast = (now.getTime() - new Date(existingOtp.lastSentAt).getTime()) / 1000;
      if (secondsSinceLast < 60) {
        const remainingCooldown = Math.ceil(60 - secondsSinceLast);
        throw new Error(`Please wait ${remainingCooldown}s before requesting a new code.`);
      }

      // 2. Enforce 3 requests per 10-minute sliding window
      const windowElapsedMinutes = (now.getTime() - new Date(existingOtp.windowStart).getTime()) / (1000 * 60);
      if (windowElapsedMinutes < 10) {
        if (existingOtp.requestCount >= 3) {
          throw new Error('Too many OTP requests for this phone number. Please try again in 10 minutes.');
        }
      }
    }

    const code = this.generateOtpCode();
    const otpHash = crypto.createHash('sha256').update(code).digest('hex');
    const expiresAt = new Date(Date.now() + env.OTP_EXPIRY_MINUTES * 60 * 1000);

    let requestCount = 1;
    let windowStart = now;

    if (existingOtp) {
      const windowElapsedMinutes = (now.getTime() - new Date(existingOtp.windowStart).getTime()) / (1000 * 60);
      if (windowElapsedMinutes < 10) {
        requestCount = existingOtp.requestCount + 1;
        windowStart = existingOtp.windowStart;
      }
    }

    // Upsert the OTP document
    await Otp.findOneAndUpdate(
      { phoneNumber },
      {
        otpHash,
        attempts: 0,
        lastSentAt: now,
        requestCount,
        windowStart,
        expiresAt
      },
      { upsert: true, new: true }
    );

    const smsMessage = `Your ${env.APP_NAME} verification code is ${code}. It expires in ${env.OTP_EXPIRY_MINUTES} minutes.`;
    await this.getProvider().sendSms(phoneNumber, smsMessage);

    // Only return mockOtp in dev/test with MOCK_OTP_ENABLED explicitly on. NEVER in production!
    const returnMock = env.MOCK_OTP_ENABLED && env.NODE_ENV !== 'production';

    return {
      success: true,
      message: 'Verification code sent successfully.',
      ...(returnMock && { mockOtp: code })
    };
  }

  static async verifyOtp(rawPhoneNumber: string, code: string): Promise<boolean> {
    const phoneNumber = normalizePhoneNumber(rawPhoneNumber);
    const record = await Otp.findOne({
      phoneNumber,
      expiresAt: { $gt: new Date() }
    });

    if (!record) {
      return false;
    }

    // Enforce max 5 verify attempts per OTP
    if (record.attempts >= 5) {
      await Otp.deleteOne({ _id: record._id });
      throw new Error('Too many incorrect attempts. This verification code has been revoked. Please request a new code.');
    }

    const isMatch = this.timingSafeVerify(code, record.otpHash);

    if (!isMatch) {
      record.attempts += 1;
      await record.save();

      if (record.attempts >= 5) {
        await Otp.deleteOne({ _id: record._id });
        throw new Error('Too many incorrect attempts. This verification code has been revoked. Please request a new code.');
      }
      return false;
    }

    // Successfully verified: clean up OTP record immediately
    await Otp.deleteOne({ _id: record._id });
    return true;
  }
}
