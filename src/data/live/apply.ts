import { forgetChatLinks } from '@/data/chatImages'
import { useMoshi } from '@/lib/store'
import { unblocking } from './bus'
import {
  chatSameKey,
  dropChat,
  dropChatMessage,
  dropEventMessage,
  dropPairAnswer,
  dropRoomMessage,
  pairKey,
  putAnswerSame,
  putChatMember,
  putChatMessage,
  putChatSame,
  putEventMessage,
  putIntro,
  putJoin,
  putMember,
  putMessageSame,
  putPairAnswer,
  putPromptSame,
  putRoomMessage,
  putRoomWatch,
  putRsvp,
  putWave,
  type Cache,
} from './cache'
import {
  apply,
  chatsPatch,
  eventMessagesPatch,
  intentsPatch,
  introsPatch,
  mePatch,
  myAnswersPatch,
  myGoingPatch,
  myIntentsPatch,
  myJoinsPatch,
  mySamesPatch,
  myWavePatch,
  pairAnswersPatch,
  peoplePatch,
  questionsPatch,
  roomMessagesPatch,
  roomsPatch,
  roomWatchPatch,
  sessionsPatch,
  storySamesPatch,
  wavePatch,
} from './publish'
import type { Change, ChatRow } from './rows'

/** Follow-up work a change may need (fetching what we haven't seen yet). */
export interface ApplyEffects {
  needChat: (chatId: string) => void
  needProfiles: (ids: string[]) => void
  /** a message landed in a chat: mark it read if that chat is on screen */
  readIfOpen: (chatId: string, createdAt: string) => void
  /** Mochi spoke in an intro chat (the question pair may have opened): fetch its answers again */
  needPair: (chatId: string) => void
}

/**
 * One row change (realtime or our own write) → the cache → only the slices
 * it touches get re-published.
 */
export function applyToCache(c: Cache, ch: Change, fx: ApplyEffects) {
  const me = c.me
  const del = ch.type === 'DELETE'
  switch (ch.table) {
    case 'profiles': {
      if (del) c.profiles.delete(ch.row.id)
      else c.profiles.set(ch.row.id, { ...c.profiles.get(ch.row.id), ...ch.row })
      if (ch.row.id === me) useMoshi.setState(mePatch(c, false))
      else apply({ ...peoplePatch(c), ...roomsPatch(c) }, {})
      return
    }
    case 'room_members':
      putMember(c, ch.row, !del)
      apply({ ...roomsPatch(c), ...peoplePatch(c) }, {})
      return
    case 'room_messages': {
      const roomId = del ? dropRoomMessage(c, ch.row.id) : putRoomMessage(c, ch.row) ? ch.row.room_id : undefined
      if (!roomId) return
      const r = roomMessagesPatch(c, [roomId])
      apply(r.cat, r.mine)
      if (!del && ch.row.user_id) fx.needProfiles([ch.row.user_id])
      return
    }
    case 'room_message_sames': {
      const roomId = c.msgRoom.get(ch.row.message_id)
      if (!roomId) return
      putMessageSame(c.roomSames, ch.row, !del)
      const r = roomMessagesPatch(c, [roomId])
      apply(r.cat, { ...r.mine, ...(ch.row.user_id === me ? mySamesPatch(c) : {}) })
      if (!del && ch.row.user_id !== me) fx.needProfiles([ch.row.user_id])
      return
    }
    case 'sessions': {
      // a new event, one that was cancelled or stopped repeating (or went with its room)
      if (del) {
        c.sessions.delete(ch.row.id)
        c.rsvps.delete(ch.row.id)
      } else c.sessions.set(ch.row.id, { ...c.sessions.get(ch.row.id), ...ch.row })
      apply(sessionsPatch(c), del ? myGoingPatch(c) : {})
      return
    }
    case 'session_rsvps':
      putRsvp(c, ch.row, !del)
      apply(sessionsPatch(c), ch.row.user_id === me ? myGoingPatch(c) : {})
      // someone new is going: make sure we know who (or that they're hidden)
      if (!del && ch.row.user_id !== me) fx.needProfiles([ch.row.user_id])
      return
    case 'event_messages': {
      // only chats being watched keep their lines (see watchEvent in sync)
      const sessionId = del ? dropEventMessage(c, ch.row.id) : putEventMessage(c, ch.row) ? ch.row.session_id : undefined
      if (!sessionId) return
      const r = eventMessagesPatch(c, [sessionId])
      apply(r.cat, r.mine)
      if (!del && ch.row.user_id !== me) fx.needProfiles([ch.row.user_id])
      return
    }
    case 'wave_answers': {
      putWave(c, ch.row, !del)
      if (ch.row.user_id === me) apply({}, myWavePatch(c))
      else apply(wavePatch(c), {})
      return
    }
    case 'daily_answers': {
      if (![...c.questions.values()].some((q) => q.id === ch.row.question_id)) return
      const key = pairKey(ch.row.question_id, ch.row.user_id)
      if (del) c.answers.delete(key)
      else c.answers.set(key, { ...c.answers.get(key), ...ch.row })
      apply(questionsPatch(c), ch.row.user_id === me ? myAnswersPatch(c) : {})
      if (!del) fx.needProfiles([ch.row.user_id])
      return
    }
    case 'daily_answer_sames':
      putAnswerSame(c, ch.row, !del)
      apply(questionsPatch(c), ch.row.user_id === me ? mySamesPatch(c) : {})
      return
    case 'intents': {
      const prev = c.intents.get(ch.row.id)
      if (del) {
        c.intents.delete(ch.row.id)
        c.joins.delete(ch.row.id)
      } else c.intents.set(ch.row.id, { ...prev, ...ch.row })
      const mine = (prev ?? ch.row).user_id === me
      apply(intentsPatch(c), mine ? myIntentsPatch(c) : {})
      if (!del && ch.row.user_id) fx.needProfiles([ch.row.user_id])
      return
    }
    case 'intent_joins': {
      const owner = c.intents.get(ch.row.intent_id)?.user_id
      if (!owner) return
      putJoin(c, ch.row, !del)
      apply(intentsPatch(c), { ...(owner === me ? myIntentsPatch(c) : {}), ...(ch.row.user_id === me ? myJoinsPatch(c) : {}) })
      // someone new pressed "ฉันด้วย" on my post: make sure we know who (or that they're hidden)
      if (!del && owner === me) fx.needProfiles([ch.row.user_id])
      return
    }
    case 'chats': {
      if (del) {
        dropChat(c, ch.row.id)
        apply({}, chatsPatch(c))
        return
      }
      // new to us: fetch it whole (members + messages) before it shows up
      if (!c.chats.has(ch.row.id)) {
        fx.needChat(ch.row.id)
        return
      }
      c.chats.set(ch.row.id, { ...c.chats.get(ch.row.id), ...ch.row } as ChatRow)
      // a moshi we just sent again: fetch the new opener too
      if (ch.type === 'INSERT') fx.needChat(ch.row.id)
      else apply({}, chatsPatch(c))
      return
    }
    case 'chat_members': {
      if (!c.chats.has(ch.row.chat_id)) {
        if (!del && ch.row.user_id === me) fx.needChat(ch.row.chat_id)
        return
      }
      // photos just switched off here (a block switches both off): stop reusing links already handed out
      const was = c.chatMembers.get(ch.row.chat_id)?.find((m) => m.user_id === ch.row.user_id)
      if (!del && was?.consent_media && ch.row.consent_media === false) forgetChatLinks(ch.row.chat_id)
      putChatMember(c, ch.row, !del)
      apply({}, chatsPatch(c))
      return
    }
    case 'chat_messages': {
      if (del) {
        if (dropChatMessage(c, ch.row.id)) apply({}, chatsPatch(c))
        return
      }
      putChatMessage(c, ch.row)
      if (!c.chats.has(ch.row.chat_id)) {
        // keep it: the chat may be loading right now and miss this line
        fx.needChat(ch.row.chat_id)
        return
      }
      if (ch.row.user_id && ch.row.user_id !== me) fx.readIfOpen(ch.row.chat_id, ch.row.created_at)
      if (ch.row.kind === 'mochi' && ch.type === 'INSERT') fx.needPair(ch.row.chat_id)
      apply({}, chatsPatch(c))
      return
    }
    case 'chat_message_sames': {
      const key = chatSameKey(c, ch.row)
      if (!key || !c.msgChat.has(key.message_id)) return
      putChatSame(c, ch.row, !del)
      apply({}, { ...chatsPatch(c), ...(key.user_id === me ? mySamesPatch(c) : {}) })
      return
    }
    case 'prompt_sames': {
      const row = putPromptSame(c, ch.row, !del)
      if (!row) return
      apply(row.profile_id === me ? storySamesPatch(c) : {}, row.user_id === me ? mySamesPatch(c) : {})
      if (!del && row.profile_id === me) fx.needProfiles([row.user_id])
      return
    }
    case 'intro_requests': {
      putIntro(c, ch.row, !del)
      apply({}, introsPatch(c))
      if (del) return
      // accepted: the chat Mochi opened (it may not have reached us yet)
      if (ch.row.chat_id && !c.chats.has(ch.row.chat_id)) fx.needChat(ch.row.chat_id)
      if (ch.row.from_user) fx.needProfiles([ch.row.from_user === me ? ch.row.to_user : ch.row.from_user])
      return
    }
    case 'chat_pair_answers': {
      if (del) {
        if (dropPairAnswer(c, ch.row.id)) apply({}, pairAnswersPatch(c))
        return
      }
      putPairAnswer(c, ch.row)
      apply({}, pairAnswersPatch(c))
      return
    }
    case 'room_watch': {
      if (del) c.roomWatch.delete(ch.row.room_id)
      else if (!putRoomWatch(c, ch.row)) return
      apply(roomWatchPatch(c), {})
      return
    }
    case 'blocks': {
      if (ch.row.blocker !== me) return
      const id = ch.row.blocked
      if (del) c.blocked.delete(id)
      else c.blocked.add(id)
      // replayed after a full reload that read the old list, so the store follows here too
      const list = useMoshi.getState().blocked
      if (del && list.includes(id)) useMoshi.setState({ blocked: list.filter((x) => x !== id) })
      else if (!del && !list.includes(id) && !unblocking.has(id)) useMoshi.setState({ blocked: [...list, id] })
      return
    }
  }
}
