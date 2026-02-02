/**
 * Yukic_Music (Multi-Track)
 * 元のUIデザインを維持しながら、複数動画の同時再生に対応
 */

// IFrame APIの読み込み
if (!window.YT) {
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
}

// グローバル定数と変数
let tracks = [];
let nextTrackId = 1;
let masterVolume = 100;

/**
 * ユーティリティ: 時間フォーマット
 */
function formatTime(seconds, includeHours = false) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0 || includeHours) {
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function showToast(message) {
    const toast = document.getElementById('toast');
    const msg = document.getElementById('toast-message');
    if (!toast || !msg) return;
    msg.textContent = message;
    toast.classList.add('show');
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

/**
 * トラッククラス
 */
class Track {
    constructor(id, container, config = null) {
        this.id = id;
        this.player = null;
        this.isPlayerReady = false;
        this.isPlaying = false;
        this.loopCount = 0;
        this.totalSeconds = 0;
        this.loopInterval = null;
        this.statsInterval = null;
        this.videoId = '';
        this.playerId = `track-player-instance-${id}`;
        this.volume = 100; // 個別ボリューム
        this.isMuted = false;

        // DOM構築
        const template = document.getElementById('track-template');
        const clone = template.content.cloneNode(true);
        this.element = clone.querySelector('.track-unit');
        this.element.dataset.trackId = id;
        this.element.querySelector('.id-number').textContent = id;

        // プレイヤー用DIVのID設定
        const pDiv = this.element.querySelector('.youtube-player-div');
        pDiv.id = this.playerId;

        // UI要素の参照
        this.ui = {
            urlInput: this.element.querySelector('.youtube-url'),
            loadBtn: this.element.querySelector('.load-video-btn'),
            removeBtn: this.element.querySelector('.remove-track-btn'),
            mvCheckbox: this.element.querySelector('.show-mv-checkbox'),
            playerContainer: this.element.querySelector('.player-container'),
            placeholder: this.element.querySelector('.player-placeholder'),
            startMin: this.element.querySelector('.start-min'),
            startSec: this.element.querySelector('.start-sec'),
            endMin: this.element.querySelector('.end-min'),
            endSec: this.element.querySelector('.end-sec'),
            setStartBtn: this.element.querySelector('.set-start-current'),
            setEndBtn: this.element.querySelector('.set-end-current'),
            loopDuration: this.element.querySelector('.loop-duration-display'),
            loopCount: this.element.querySelector('.loop-count'),
            totalTime: this.element.querySelector('.total-time'),
            currentPos: this.element.querySelector('.current-position'),
            playBtn: this.element.querySelector('.play-btn'),
            pauseBtn: this.element.querySelector('.pause-btn'),
            resetBtn: this.element.querySelector('.reset-btn'),
            statsSection: this.element.querySelector('.stats-section'),
            playerSection: this.element.querySelector('.player-section'),
            playerSection: this.element.querySelector('.player-section'),
            volumeSlider: this.element.querySelector('.track-volume-slider'),
            volumeIcon: this.element.querySelector('.volume-control-group .volume-icon')
        };

        container.appendChild(this.element);

        // イベントリスナー登録
        this.ui.loadBtn.addEventListener('click', () => this.loadVideo());
        this.ui.urlInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') this.loadVideo(); });
        this.ui.removeBtn.addEventListener('click', () => this.destroy());
        this.ui.mvCheckbox.addEventListener('change', () => this.updateMvVisibility());
        this.ui.playBtn.addEventListener('click', () => this.start());
        this.ui.pauseBtn.addEventListener('click', () => this.pause());
        this.ui.resetBtn.addEventListener('click', () => this.reset());
        this.ui.setStartBtn.addEventListener('click', () => this.setStartCurrent());
        this.ui.setEndBtn.addEventListener('click', () => this.setEndCurrent());

        this.ui.volumeSlider.addEventListener('input', (e) => {
            this.volume = parseInt(e.target.value);
            // ミュート中にスライダー操作したらミュート解除する？今回はしない
            if (!this.isMuted) this.applyVolume();
        });

        this.ui.volumeIcon.addEventListener('click', () => this.toggleMute());

        [this.ui.startMin, this.ui.startSec, this.ui.endMin, this.ui.endSec].forEach(el => {
            el.addEventListener('change', () => this.updateLoopDurationDisplay());
        });

        // 初期設定
        if (config) {
            this.applyConfig(config);
        }
    }

    extractVideoId(url) {
        const patterns = [
            /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\?\/]+)/,
            /youtube\.com\/watch\?.*v=([^&]+)/,
            /^([a-zA-Z0-9_-]{11})$/
        ];
        for (const p of patterns) {
            const match = url.match(p);
            if (match) return match[1];
        }
        return null;
    }

    loadVideo() {
        const videoId = this.extractVideoId(this.ui.urlInput.value.trim());
        if (!videoId) {
            showToast('有効なURLを入力してください ⚠️');
            return;
        }
        this.initPlayer(videoId);
    }

    initPlayer(videoId) {
        if (this.player) {
            try { this.player.destroy(); } catch (e) { }
            // DIVが消えるため再作成
            const div = document.createElement('div');
            div.id = this.playerId;
            div.className = 'youtube-player-div';
            this.ui.playerContainer.appendChild(div);
        }
        this.ui.placeholder.style.display = 'none';
        this.videoId = videoId;
        this.player = new YT.Player(this.playerId, {
            height: '100%', width: '100%', videoId: videoId,
            playerVars: { 'playsinline': 1, 'rel': 0, 'modestbranding': 1 },
            events: {
                'onReady': (e) => this.onPlayerReady(e),
                'onStateChange': (e) => this.onPlayerStateChange(e)
            }
        });
    }

    onPlayerReady(event) {
        this.isPlayerReady = true;
        this.ui.playBtn.disabled = false;
        this.ui.pauseBtn.disabled = false;
        const duration = this.player.getDuration();
        if (this.getEndTime() === 0) {
            this.ui.endMin.value = Math.floor(Math.min(30, duration) / 60);
            this.ui.endSec.value = Math.floor(Math.min(30, duration) % 60);
        }
        this.updateLoopDurationDisplay();
        this.updateMvVisibility();
        this.applyVolume();
        showToast(`TRACK #${this.id} 読み込み完了!`);
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        this.updateVolumeUI();
        this.applyVolume();
    }

    updateVolumeUI() {
        if (this.isMuted) {
            this.ui.volumeIcon.textContent = '🔇';
            this.ui.volumeSlider.disabled = true;
        } else {
            this.ui.volumeIcon.textContent = '🔊';
            this.ui.volumeSlider.disabled = false;
        }
    }

    applyVolume() {
        if (!this.player || !this.player.setVolume) return;
        if (this.isMuted) {
            this.player.setVolume(0);
        } else {
            const effectiveVolume = Math.floor(this.volume * (masterVolume / 100));
            this.player.setVolume(effectiveVolume);
        }
    }

    onPlayerStateChange(event) {
        if (event.data === YT.PlayerState.PLAYING) {
            this.ui.playerSection.classList.add('playing');
            this.ui.playerSection.classList.remove('paused');
        } else if (event.data === YT.PlayerState.PAUSED) {
            this.ui.playerSection.classList.remove('playing');
            this.ui.playerSection.classList.add('paused');
        } else {
            this.ui.playerSection.classList.remove('playing', 'paused');
        }
    }

    getStartTime() {
        return (parseInt(this.ui.startMin.value) || 0) * 60 + (parseFloat(this.ui.startSec.value) || 0);
    }

    getEndTime() {
        return (parseInt(this.ui.endMin.value) || 0) * 60 + (parseFloat(this.ui.endSec.value) || 0);
    }

    updateLoopDurationDisplay() {
        const diff = this.getEndTime() - this.getStartTime();
        if (diff <= 0) {
            this.ui.loopDuration.textContent = '無効な区間';
            this.ui.loopDuration.style.color = '#ef4444';
        } else {
            // 小数点がある場合は表示
            const isDecimal = diff % 1 !== 0;
            this.ui.loopDuration.textContent = isDecimal
                ? `${diff.toFixed(2)}秒`
                : formatTime(diff);
            this.ui.loopDuration.style.color = '';
        }
    }

    updateMvVisibility() {
        if (this.ui.mvCheckbox.checked) {
            this.ui.playerContainer.classList.remove('hidden-mv');
        } else {
            this.ui.playerContainer.classList.add('hidden-mv');
        }
    }

    start() {
        if (!this.isPlayerReady || !this.player) return;
        const start = this.getStartTime();
        const end = this.getEndTime();
        if (end <= start) {
            showToast('終了時間を開始時間より後にしてください ⚠️');
            return;
        }
        this.isPlaying = true;
        this.player.seekTo(start, true);
        this.player.playVideo();
        if (this.loopInterval) clearInterval(this.loopInterval);
        this.loopInterval = setInterval(() => this.checkLoop(), 100);
        if (this.statsInterval) clearInterval(this.statsInterval);
        this.statsInterval = setInterval(() => { if (this.isPlaying) this.totalSeconds++; this.updateStatsUI(); }, 1000);
        this.ui.playBtn.innerHTML = '<span class="btn-icon">▶️</span><span>再生中...</span>';
    }

    pause() {
        if (!this.player) return;
        this.isPlaying = false;
        this.player.pauseVideo();
        this.ui.playBtn.innerHTML = '<span class="btn-icon">▶️</span><span>再開</span>';
    }

    reset() {
        this.pause();
        this.loopCount = 0;
        this.totalSeconds = 0;
        this.updateStatsUI();
        if (this.player && this.isPlayerReady) {
            this.player.seekTo(this.getStartTime(), true);
            this.player.pauseVideo();
        }
        this.ui.playBtn.innerHTML = '<span class="btn-icon">▶️</span><span>耐久開始</span>';
    }

    checkLoop() {
        if (!this.player || !this.isPlaying) return;
        const current = this.player.getCurrentTime();
        const start = this.getStartTime();
        const end = this.getEndTime();
        if (current >= end) {
            this.loopCount++;
            this.player.seekTo(start, true);
            this.ui.statsSection.classList.add('looping');
            setTimeout(() => this.ui.statsSection.classList.remove('looping'), 1000);
            this.ui.loopCount.textContent = this.loopCount.toLocaleString();
        }
        this.ui.currentPos.textContent = formatTime(current);
    }

    updateStatsUI() {
        this.ui.totalTime.textContent = formatTime(this.totalSeconds, true);
        this.ui.loopCount.textContent = this.loopCount.toLocaleString();
    }

    setStartCurrent() {
        if (!this.player || !this.isPlayerReady) return;
        const cur = this.player.getCurrentTime();
        this.ui.startMin.value = Math.floor(cur / 60);
        this.ui.startSec.value = (cur % 60).toFixed(2);
        this.updateLoopDurationDisplay();
    }

    setEndCurrent() {
        if (!this.player || !this.isPlayerReady) return;
        const cur = this.player.getCurrentTime();
        this.ui.endMin.value = Math.floor(cur / 60);
        this.ui.endSec.value = (cur % 60).toFixed(2);
        this.updateLoopDurationDisplay();
    }

    destroy() {
        if (this.player) try { this.player.destroy(); } catch (e) { }
        if (this.loopInterval) clearInterval(this.loopInterval);
        if (this.statsInterval) clearInterval(this.statsInterval);
        this.element.remove();
        tracks = tracks.filter(t => t.id !== this.id);
    }

    getConfig() {
        return {
            url: this.ui.urlInput.value,
            videoId: this.videoId,
            startMin: this.ui.startMin.value,
            startSec: this.ui.startSec.value,
            endMin: this.ui.endMin.value,
            endSec: this.ui.endSec.value,
            showMv: this.ui.mvCheckbox.checked,
            volume: this.volume,
            isMuted: this.isMuted
        };
    }

    applyConfig(c) {
        this.ui.urlInput.value = c.url || '';
        this.videoId = c.videoId || '';
        this.ui.startMin.value = c.startMin || 0;
        this.ui.startSec.value = c.startSec || 0;
        this.ui.endMin.value = c.endMin || 0;
        this.ui.endSec.value = c.endSec || 30;
        this.ui.mvCheckbox.checked = c.showMv !== false;

        if (c.volume !== undefined) {
            this.volume = c.volume;
            this.ui.volumeSlider.value = c.volume;
        }

        if (c.isMuted !== undefined) {
            this.isMuted = c.isMuted;
            this.updateVolumeUI();
        }

        if (this.videoId) this.initPlayer(this.videoId);
    }
}

/**
 * グローバル初期化
 */
function onYouTubeIframeAPIReady() {
    console.log('Yukic_Music Engine Ready');
    if (tracks.length === 0) {
        addTrack();
    }
}

function addTrack(config = null) {
    const list = document.getElementById('tracks-list');
    const t = new Track(nextTrackId++, list, config);
    tracks.push(t);
}

// ボタンイベント
document.getElementById('add-track').addEventListener('click', () => addTrack());

document.getElementById('master-play').addEventListener('click', () => {
    tracks.forEach(track => track.start());
    showToast('すべてのトラックを開始！🚀');
});

let allMvVisible = true;
document.getElementById('master-toggle-mv').addEventListener('click', () => {
    allMvVisible = !allMvVisible;
    tracks.forEach(t => {
        t.ui.mvCheckbox.checked = allMvVisible;
        t.updateMvVisibility();
    });
    showToast(`すべてのMVを ${allMvVisible ? '表示' : '非表示'} にしました`);
});

document.getElementById('master-pause').addEventListener('click', () => {
    tracks.forEach(track => track.pause());
    showToast('一時停止しました ⏸️');
});

document.getElementById('master-reset').addEventListener('click', () => {
    tracks.forEach(track => track.reset());
    showToast('リセット完了 🔄');
});

// マスターボリューム
document.getElementById('master-volume-slider').addEventListener('input', (e) => {
    masterVolume = parseInt(e.target.value);
    tracks.forEach(track => track.applyVolume());
});

// JSON共有
document.getElementById('export-json').addEventListener('click', () => {
    const data = tracks.map(t => t.getConfig());
    navigator.clipboard.writeText(JSON.stringify(data, null, 2))
        .then(() => showToast('全設定をJSONでコピーしました！'));
});

document.getElementById('import-json').addEventListener('click', () => {
    document.getElementById('import-container').classList.toggle('hidden');
});

document.getElementById('apply-json').addEventListener('click', () => {
    try {
        const json = document.getElementById('json-input').value.trim();
        const data = JSON.parse(json);
        if (!Array.isArray(data)) return;

        // 既存トラックを全削除
        [...tracks].forEach(t => t.destroy());
        tracks = [];
        nextTrackId = 1;

        data.forEach(c => addTrack(c));
        document.getElementById('import-container').classList.add('hidden');
        showToast('バックアップから復元しました！✨');
    } catch (e) {
        alert('Invalid JSON');
    }
});

// 警告
window.addEventListener('beforeunload', (e) => {
    if (tracks.some(t => t.isPlaying)) {
        e.preventDefault(); e.returnValue = '';
    }
});
