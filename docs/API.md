# RSM Messenger REST API Reference

Base URL: `http://localhost:5000/api/v1`

---

## 1. Authentication (`/auth`)
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/auth/request-otp` | Request OTP code for phone number | No |
| `POST` | `/auth/verify-otp` | Verify OTP and receive JWT access & refresh tokens | No |
| `POST` | `/auth/refresh-token` | Rotate refresh token and issue new access token | No |
| `POST` | `/auth/logout` | Invalidate current device session | Yes |
| `POST` | `/auth/logout-all` | Invalidate all sessions across all devices | Yes |
| `DELETE` | `/auth/delete-account` | Permanently delete account and all data | Yes |

---

## 2. Users & Privacy (`/users`)
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/users/profile` | Get current user's profile | Yes |
| `PUT` | `/users/profile` | Update name, about, or username | Yes |
| `POST` | `/users/avatar` | Upload and crop profile photo | Yes |
| `GET` | `/users/privacy` | Get current user's privacy rules | Yes |
| `PUT` | `/users/privacy` | Update last seen, online, photo, about, read receipts | Yes |
| `GET` | `/users/blocked` | List blocked contacts | Yes |
| `POST` | `/users/block` | Block target user | Yes |
| `DELETE` | `/users/block/:targetUserId` | Unblock target user | Yes |
| `GET` | `/users/:id` | Get public profile of user (backend privacy enforced) | Yes |

---

## 3. Contacts (`/contacts`)
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/contacts/sync` | Sync phone address book and match registered users | Yes |
| `GET` | `/contacts` | List synced contacts with search & registered filter | Yes |
| `POST` | `/contacts` | Add a single contact manually | Yes |

---

## 4. Chats (`/chats`)
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/chats` | Get all 1-to-1 & group conversations (pinned first) | Yes |
| `POST` | `/chats/direct` | Get or create 1-to-1 direct conversation | Yes |
| `GET` | `/chats/:id` | Get chat details by ID | Yes |
| `POST` | `/chats/:id/pin` | Pin or unpin chat | Yes |
| `POST` | `/chats/:id/archive` | Archive or unarchive chat | Yes |
| `POST` | `/chats/:id/mute` | Mute notifications | Yes |
| `POST` | `/chats/:id/clear` | Clear message history for current user | Yes |
| `POST` | `/chats/:id/disappearing` | Configure self-destruct timer (off, 24h, 7d, 90d) | Yes |

---

## 5. Messages (`/messages`)
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/messages/chat/:chatId` | Get paginated messages with cursor / infinite scroll | Yes |
| `POST` | `/messages` | Send message (text, media, audio, location, contact) | Yes |
| `PUT` | `/messages/:id` | Edit content of sent message | Yes |
| `DELETE` | `/messages/:id/me` | Delete message for me | Yes |
| `DELETE` | `/messages/:id/everyone` | Delete message for everyone (WhatsApp style) | Yes |
| `POST` | `/messages/:id/react` | Add, change, or remove emoji reaction | Yes |
| `POST` | `/messages/:id/star` | Star or unstar message | Yes |
| `GET` | `/messages/starred` | List all starred messages | Yes |
| `POST` | `/messages/:id/pin` | Pin or unpin message inside chat | Yes |
| `POST` | `/messages/forward` | Forward 1 or multiple messages | Yes |
| `GET` | `/messages/search` | Search message contents globally or in chat | Yes |
| `GET` | `/messages/:id/context` | Load surrounding message window for search jumps | Yes |

---

## 6. Groups (`/groups`)
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/groups` | Create group with name, description, avatar & members | Yes |
| `PUT` | `/groups/:id` | Update group subject, description, or icon | Yes |
| `POST` | `/groups/:id/members` | Add new members (admin only; max 1024) | Yes |
| `DELETE` | `/groups/:id/members/:memberId` | Remove member or leave group (auto ownership transfer) | Yes |
| `POST` | `/groups/:id/members/:memberId/promote` | Promote member to admin | Yes |
| `POST` | `/groups/:id/members/:memberId/demote` | Demote admin back to member | Yes |
| `PUT` | `/groups/:id/settings` | Toggle onlyAdminsCanSend / onlyAdminsCanEditInfo | Yes |
| `GET` | `/groups/:id/pending-members` | List join requests (when approveNewMembers is true) | Yes (Admin) |
| `POST` | `/groups/:id/approve-member` | Approve pending join request | Yes (Admin) |
| `POST` | `/groups/:id/reject-member` | Reject pending join request | Yes (Admin) |
| `POST` | `/groups/:id/reset-invite` | Reset group invite code | Yes |
| `POST` | `/groups/join/:code` | Join group via invite link | Yes |

---

## 7. Status Stories (`/status`)
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/status` | Post text or image status with 24h TTL expiration | Yes |
| `GET` | `/status/feed` | Get 24-hour status stories from mutual chats/contacts | Yes |
| `GET` | `/status/my` | Get own active statuses with viewer details | Yes |
| `POST` | `/status/:id/view` | Mark status as viewed (respects read receipts) | Yes |
| `POST` | `/status/:id/react` | React to status update (one per user) | Yes |
| `POST` | `/status/:id/reply` | Reply to status creating direct quote message | Yes |
| `DELETE` | `/status/:id` | Delete status update | Yes |

---

## 8. WebRTC Calling (`/calls`)
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/calls/ice-servers` | Get STUN and ephemeral HMAC-SHA1 TURN credentials | Yes |
| `POST` | `/calls/log` | Create call initiation log entry | Yes |
| `PUT` | `/calls/log/:id` | Update call status (connected, ended, duration) | Yes |
| `GET` | `/calls/history` | Get voice and video call logs | Yes |
| `DELETE` | `/calls/log/:id` | Delete call entry from history | Yes |

---

## 9. Media & Uploads (`/media`)
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/media/upload` | Upload image, video, audio, or document (magic-byte check) | Yes |

---

## 10. Devices & Push Notifications (`/devices`)
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `PUT` | `/devices/push-token` | Register or update Expo push token for device | Yes |
| `GET` | `/devices` | List active sessions and linked devices | Yes |
| `DELETE` | `/devices/:id` | Revoke device session (forces WebSocket disconnect) | Yes |

---

## 11. Communities & Channels (`/communities` & `/channels`)
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/communities` | List communities accessible to current user | Yes |
| `POST` | `/communities/:id/join` | Join community and announcement channel | Yes |
| `DELETE` | `/communities/:id/groups` | Remove linked group from community | Yes (Admin) |
| `PUT` | `/channels/posts/:postId` | Edit channel broadcast post | Yes (Admin) |
| `DELETE` | `/channels/posts/:postId` | Delete channel broadcast post | Yes (Admin) |
| `POST` | `/channels/posts/:postId/react` | React to channel post | Yes |

---

## 12. Admin Console (`/admin`)
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/admin/stats` | Analytics, total counts, aggregated byte storage size | Yes (Admin) |
| `GET` | `/admin/users` | List users with pagination and search | Yes (Admin) |
| `GET` | `/admin/users/:id/details` | View user device sessions, reports, and activity | Yes (Admin) |
| `POST` | `/admin/users/:id/suspend` | Suspend or unsuspend user (disconnects sessions) | Yes (Admin) |
| `DELETE` | `/admin/users/:id` | Cascade delete user account | Yes (Admin) |
| `POST` | `/admin/broadcast` | Broadcast announcement notification to all users | Yes (Admin) |
| `GET` | `/admin/reports` | List pending abuse reports with evidence | Yes (Admin) |
| `POST` | `/admin/reports/:id/resolve` | Resolve report with suspend_user or delete_message action | Yes (Admin) |
| `GET` | `/admin/health` | Process diagnostics, socket count, and MongoDB ping | Yes (Admin) |

