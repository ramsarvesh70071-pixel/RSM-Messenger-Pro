# RSM Messenger Database Schema & Indexing Guide

Database Engine: **MongoDB 6+**  
ODM: **Mongoose 8**  
Database Name: `rsm_messenger`

---

## 1. Primary Collections & Schemas

### `users`
| Field | Type | Attributes | Description |
|---|---|---|---|
| `phoneNumber` | String | Unique, Indexed | E.164 phone format |
| `countryCode` | String | Default `+91` | Country dial code |
| `name` | String | Max 60 chars | Display name |
| `username` | String | Unique, Sparse | Handle |
| `about` | String | Default text | Status bio |
| `avatarUrl` | String | URL | Profile image |
| `isOnline` | Boolean | Indexed | Active presence |
| `lastSeen` | Date | Timestamp | Last active |
| `role` | String | `user`, `admin`, `moderator` | Access control |
| `privacySettings` | Subdocument | Embedded | Privacy controls |

**Indexes:**
- `{ phoneNumber: 1 }` (unique)
- `{ username: 1 }` (unique, sparse)
- `{ isOnline: 1 }`
- `{ name: "text", about: "text", username: "text" }`

---

### `chats`
| Field | Type | Attributes | Description |
|---|---|---|---|
| `type` | String | `direct`, `group`, `channel_comments` | Conversation type |
| `name` | String | Optional | Group title |
| `participants` | ObjectId[] | Refs `User`, Indexed | Members array (max 1024) |
| `pendingRequests` | ObjectId[] | Refs `User` | Join requests when approveNewMembers is true |
| `membersMeta` | Subdoc[] | Embedded | Pinned, archived, mute status, role |
| `lastMessage` | ObjectId | Ref `Message` | Pointer to latest message |
| `lastMessageAt` | Date | Indexed, Desc | Last activity timestamp |
| `groupSettings` | Subdocument | Embedded | `approveNewMembers`, `onlyAdminsCanSend`, `onlyAdminsCanEditInfo` |
| `disappearingConfig`| Subdocument | Embedded | Auto-destruct expiration timer |

**Indexes:**
- `{ participants: 1, type: 1 }`
- `{ lastMessageAt: -1 }`
- `{ "membersMeta.userId": 1 }`

---

### `messages`
| Field | Type | Attributes | Description |
|---|---|---|---|
| `chatId` | ObjectId | Ref `Chat`, Indexed | Parent chat |
| `senderId` | ObjectId | Ref `User`, Indexed | Sender |
| `clientMsgId` | String | Sparse, Indexed | Client-generated UUID for idempotency |
| `status` | String | `sent`, `delivered`, `read` | Current delivery state |
| `deliveredTo` | Subdoc[] | Embedded | User IDs and delivery timestamps |
| `type` | String | `text`, `image`, `video`, `audio`, `voice`, `document`, `location`, `contact`, `system` | Format |
| `content` | String | Text content | Body or caption |
| `attachments` | Subdoc[] | Embedded | File metadata, dimensions, waveform, fileSize |
| `replyTo` | Subdocument | Embedded | Quoted message preview |
| `reactions` | Subdoc[] | Embedded | Emojis and reacting userIds |
| `readBy` | Subdoc[] | Embedded | Read receipts with timestamps |
| `isPinned` | Boolean | Indexed | Sticky message in chat |
| `isStarredBy` | ObjectId[] | Refs `User`, Indexed | Favorite bookmarks |
| `expiresAt` | Date | TTL Index | Auto self-destruct for disappearing messages |

**Indexes:**
- `{ chatId: 1, createdAt: -1 }`
- `{ chatId: 1, senderId: 1, clientMsgId: 1 }` (unique, sparse partial index)
- `{ chatId: 1, isPinned: 1 }`
- `{ expiresAt: 1 }` (expireAfterSeconds: 0)
- `{ content: "text" }`

---

### `statuses` (Stories)
| Field | Type | Attributes | Description |
|---|---|---|---|
| `userId` | ObjectId | Ref `User`, Indexed | Author |
| `type` | String | `text`, `image`, `video` | Story format |
| `content` | String | URL or text | Content |
| `reactions` | Subdoc[] | Embedded | Emojis and reacting user IDs (one per user) |
| `views` | Subdoc[] | Embedded | Seen timestamps and userIds |
| `expiresAt` | Date | TTL Index | Exact time when MongoDB deletes story |

**Indexes:**
- `{ userId: 1, createdAt: -1 }`
- `{ expiresAt: 1 }` (expireAfterSeconds: 0)

---

### Additional Collections
- **`audit_logs`**: Records administrator actions (`adminId`, `action`, `targetType`, `targetId`, `details`, `ipAddress`, `timestamp`).
- **`uploads`**: Tracks uploaded media assets, MIME types, magic bytes, storage keys, and uploading user IDs.
- **`reports`**: Stores user abuse reports, categories, reported message/user references, evidence, and moderation resolution state (`pending`, `reviewing`, `resolved`, `dismissed`).
- **`calls`**: WebRTC call sessions (`callerId`, `receiverId`, `chatId`, `callType`, `status`, `startedAt`, `endedAt`, `duration`).

