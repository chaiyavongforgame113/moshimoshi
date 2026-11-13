/**
 * Server pieces that arrive with a later migration. Each starts off and is switched on by the
 * first load that finds it, so the app keeps working on a database that hasn't caught up yet.
 * Pages read them through useServerFeatures() (data/hooks), which mirrors these in the catalog.
 */
export const features = {
  /** prompt_sames (20261108000003_live_reactions.sql): "เหมือนกัน!" on profile stories reaches their owner */
  promptSames: false,
  /**
   * event_messages + the new sessions columns (20261114000001_room_events.sql): event chats,
   * creating / cancelling events, cancelled and weekly events. Off: sessions show as before and an
   * event's chat says "เร็วๆ นี้".
   */
  events: false,
  /** wave_answers (20261114000002_wave_quiz.sql): "จูนคลื่น" picks shared for matching. Off: they stay on this device */
  waveQuiz: false,
}
