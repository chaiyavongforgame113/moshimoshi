/**
 * Feature switches.
 *
 * dailyQuestion: "คำถามวันนี้ / Today's question" is hidden for now (the room's question
 * tab and the quiet-room opener). Its code, hooks and database tables stay as they are,
 * so turning this back on brings those back. The Home block was removed in the redesign.
 */
export const flags = { dailyQuestion: false } as const
