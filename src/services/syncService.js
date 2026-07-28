/**
 * Hybrid Sync Engine for OSCE Master Pulse
 * Uses BroadcastChannel for instant local cross-tab sync (zero config/offline)
 * Fallback to LocalStorage events if BroadcastChannel is unsupported.
 */

const CHANNEL_NAME = 'OSCE_SYNC_CHANNEL_V1';

class SyncService {
  constructor() {
    this.listeners = [];
    this.channel = null;
    this.initChannel();
  }

  initChannel() {
    if ('BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel(CHANNEL_NAME);
        this.channel.onmessage = (event) => {
          this.notifyListeners(event.data);
        };
      } catch (err) {
        console.warn('BroadcastChannel error, falling back to window storage events:', err);
      }
    }

    // Storage event fallback
    window.addEventListener('storage', (e) => {
      if (e.key === 'OSCE_SYNC_EVENT' && e.newValue) {
        try {
          const payload = JSON.parse(e.newValue);
          this.notifyListeners(payload);
        } catch (err) {
          console.error('Storage event parse error:', err);
        }
      }
    });
  }

  // Subscribe to sync events
  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  notifyListeners(data) {
    this.listeners.forEach(cb => {
      try {
        cb(data);
      } catch (err) {
        console.error('Error in sync listener callback:', err);
      }
    });
  }

  // Broadcast an action (Timer change, Cue Prompt trigger, Rubric click, State sync)
  broadcast(actionType, payload = {}, roomId = 'DEFAULT_ROOM') {
    const message = {
      type: actionType,
      payload,
      roomId,
      timestamp: Date.now(),
      senderId: this.getSenderId()
    };

    // 1. BroadcastChannel
    if (this.channel) {
      try {
        this.channel.postMessage(message);
      } catch (e) {
        console.error('BroadcastChannel postMessage failed:', e);
      }
    }

    // 2. LocalStorage trigger for fallback
    try {
      localStorage.setItem('OSCE_SYNC_EVENT', JSON.stringify(message));
    } catch (e) {
      // quota or security error
    }

    // Notify local listeners on the same tab too
    this.notifyListeners(message);
  }

  getSenderId() {
    if (!this.senderId) {
      this.senderId = 'user_' + Math.random().toString(36).substr(2, 9);
    }
    return this.senderId;
  }
}

export const syncEngine = new SyncService();

// Action Constants
export const SYNC_ACTIONS = {
  TIMER_CONTROL: 'TIMER_CONTROL',        // { state: 'RUNNING'|'PAUSED'|'RESET', secondsLeft, phase }
  CUE_PROMPT_TRIGGER: 'CUE_PROMPT_TRIGGER', // { cueCard, examinerName }
  CUE_PROMPT_CLOSE: 'CUE_PROMPT_CLOSE',   // Candidate closes cue card overlay
  EXAMINER_SCORE_UPDATE: 'EXAMINER_SCORE_UPDATE', // { examinerId, rubricId, points, notes }
  STATION_CHANGE: 'STATION_CHANGE',      // Host changes active station
  ROOM_STATE_SYNC: 'ROOM_STATE_SYNC'     // Full room state broadcast
};
