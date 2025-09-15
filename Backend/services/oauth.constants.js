/**
 * @file Centralized constants for OAuth 2.0 flows.
 * This file defines the available scopes and the user data fields they grant access to.
 */

/**
 * A map of all available scopes and their descriptions.
 * This is the single source of truth for what scopes can be requested.
 */
const ALLOWED_SCOPES = {
  'read:user': 'قراءة معلومات الملف الشخصي الأساسية (اسم المستخدم، البريد الوهمي).',
  // صلاحية جديدة أكثر حساسية
  'read:user:email': 'قراءة البريد الإلكتروني الحقيقي للمستخدم.',
};

/**
 * Maps scopes to the user fields they grant access to.
 * This is used to dynamically build the `select` clause in Prisma queries,
 * ensuring that only the data permitted by the granted scopes is returned.
 */
const USER_INFO_SCOPES_MAP = {
  // Default fields included with any valid token.
  // The 'sub' (subject) claim MUST be the user's unique, non-reassignable identifier.
  // We use the publicId for this to avoid exposing the internal database ID.
  default: {
    sub: (user) => user.publicId.toString(),
  },
  'read:user': {
    username: (user) => user.username || user.email.split('@')[0],
    email: (user) => user.virtualEmail?.address || null,
    email_verified: (user) => user.isVerified,
  },
  // عند طلب هذه الصلاحية، سنقوم بتجاوز حقل البريد الإلكتروني ليعيد البريد الحقيقي
  'read:user:email': {
    email: (user) => user.email, // يعيد البريد الإلكتروني الحقيقي
  },
};

module.exports = {
  ALLOWED_SCOPES,
  USER_INFO_SCOPES_MAP,
};