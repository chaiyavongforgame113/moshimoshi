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
  /** profiles.life_stages (20261117000001_lifestage_intro_watch.sql). Off: they aren't saved (the editor hides) */
  lifeStages: false,
  /** intro_requests + chat_pair_answers (same file): Mochi's warm intros and the question pair */
  intros: false,
  /** room_watch + watch_viewers (same file): watching clips together in rooms */
  watch: false,
  /** wave_card_preview() (same file): a shared wave card's link works signed out. Off: no card to share */
  waveCard: false,
}
