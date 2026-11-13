/**
 * Feature switches.
 *
 * dailyQuestion: "คำถามวันนี้ / Today's question" is hidden for now (the Home block,
 * the room's question tab and the quiet-room opener). Its code, hooks and database
 * tables stay as they are, so turning this back on brings it all back.
 */
export const flags = { dailyQuestion: false } as const
