/**
 * YouTube 時間耐久チャレンジ
 * ループ区間を指定してYouTube動画を耐久再生するアプリケーション
 */

// YouTube IFrame API を読み込む
const tag = document.createElement('script');
tag.src = 'https://www.youtube.com/iframe_api';
const firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

// グローバル変数
let player = null;
let isPlayerReady = false;
let loopInterval = null;
let statsInterval = null;
let loopCount = 0;
let totalSeconds = 0;
let isPlaying = false;
let currentVideoId = '';

// DOM要素
const elements = {
    youtubeUrl: document.getElementById('youtube-url'),
    loadVideo: document.getElementById('load-video'),
    playerPlaceholder: document.getElementById('player-placeholder'),
    playerSection: document.querySelector('.player-section'),
    startMin: document.getElementById('start-min'),
    startSec: document.getElementById('start-sec'),
    endMin: document.getElementById('end-min'),
    endSec: document.getElementById('end-sec'),
    setStartCurrent: document.getElementById('set-start-current'),
    setEndCurrent: document.getElementById('set-end-current'),
    loopDurationDisplay: document.getElementById('loop-duration-display'),
    loopCount: document.getElementById('loop-count'),
    totalTime: document.getElementById('total-time'),
    currentPosition: document.getElementById('current-position'),
    playBtn: document.getElementById('play-btn'),
    pauseBtn: document.getElementById('pause-btn'),
    resetBtn: document.getElementById('reset-btn'),
    exportJson: document.getElementById('export-json'),
    importJson: document.getElementById('import-json'),
    applyJson: document.getElementById('apply-json'),
    jsonPreview: document.getElementById('json-preview'),
    jsonInput: document.getElementById('json-input'),
    importContainer: document.getElementById('import-container'),
    toast: document.getElementById('toast'),
    toastMessage: document.getElementById('toast-message')
};

/**
 * YouTube IFrame API が読み込まれた時に呼ばれる
 */
function onYouTubeIframeAPIReady() {
    console.log('YouTube IFrame API Ready');
}

/**
 * YouTube URLから動画IDを抽出
 */
function extractVideoId(url) {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\?\/]+)/,
        /youtube\.com\/watch\?.*v=([^&]+)/,
        /^([a-zA-Z0-9_-]{11})$/
    ];
    
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    return null;
}

/**
 * プレーヤーを初期化
 */
function initPlayer(videoId) {
    if (player) {
        player.destroy();
    }
    
    elements.playerPlaceholder.style.display = 'none';
    currentVideoId = videoId;
    
    player = new YT.Player('player', {
        height: '100%',
        width: '100%',
        videoId: videoId,
        playerVars: {
            'playsinline': 1,
            'rel': 0,
            'modestbranding': 1
        },
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange
        }
    });
}

/**
 * プレーヤー準備完了時
 */
function onPlayerReady(event) {
    isPlayerReady = true;
    elements.playBtn.disabled = false;
    elements.pauseBtn.disabled = false;
    
    // 動画の長さに基づいて終了時間を初期設定
    const duration = player.getDuration();
    if (getEndTime() === 0 || getEndTime() > duration) {
        const endMin = Math.floor(Math.min(30, duration) / 60);
        const endSec = Math.floor(Math.min(30, duration) % 60);
        elements.endMin.value = endMin;
        elements.endSec.value = endSec;
    }
    
    updateLoopDurationDisplay();
    updateJsonPreview();
    showToast('動画を読み込みました！🎬');
}

/**
 * プレーヤー状態変更時
 */
function onPlayerStateChange(event) {
    if (event.data === YT.PlayerState.PLAYING) {
        elements.playerSection.classList.add('playing');
        elements.playerSection.classList.remove('paused');
    } else if (event.data === YT.PlayerState.PAUSED) {
        elements.playerSection.classList.remove('playing');
        elements.playerSection.classList.add('paused');
    } else {
        elements.playerSection.classList.remove('playing', 'paused');
    }
}

/**
 * 開始時間を秒数で取得
 */
function getStartTime() {
    const min = parseInt(elements.startMin.value) || 0;
    const sec = parseInt(elements.startSec.value) || 0;
    return min * 60 + sec;
}

/**
 * 終了時間を秒数で取得
 */
function getEndTime() {
    const min = parseInt(elements.endMin.value) || 0;
    const sec = parseInt(elements.endSec.value) || 0;
    return min * 60 + sec;
}

/**
 * ループ区間表示を更新
 */
function updateLoopDurationDisplay() {
    const duration = getEndTime() - getStartTime();
    if (duration <= 0) {
        elements.loopDurationDisplay.textContent = '無効な区間';
        elements.loopDurationDisplay.style.color = '#ef4444';
    } else {
        elements.loopDurationDisplay.textContent = formatTime(duration);
        elements.loopDurationDisplay.style.color = '';
    }
}

/**
 * 時間をフォーマット (HH:MM:SS or MM:SS)
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

/**
 * 耐久開始
 */
function startEndurance() {
    if (!isPlayerReady || !player) return;
    
    const startTime = getStartTime();
    const endTime = getEndTime();
    
    if (endTime <= startTime) {
        showToast('終了時間は開始時間より後に設定してください ⚠️');
        return;
    }
    
    isPlaying = true;
    player.seekTo(startTime, true);
    player.playVideo();
    
    // ループチェック開始
    if (loopInterval) clearInterval(loopInterval);
    loopInterval = setInterval(checkLoop, 100);
    
    // 統計更新開始
    if (statsInterval) clearInterval(statsInterval);
    statsInterval = setInterval(updateStats, 1000);
    
    elements.playBtn.innerHTML = '<span class="btn-icon">▶️</span><span>再生中...</span>';
    showToast('耐久開始！頑張れ！💪');
}

/**
 * ループをチェック
 */
function checkLoop() {
    if (!player || !isPlaying) return;
    
    const currentTime = player.getCurrentTime();
    const endTime = getEndTime();
    const startTime = getStartTime();
    
    if (currentTime >= endTime) {
        loopCount++;
        player.seekTo(startTime, true);
        
        // ループアニメーション
        const statsSection = document.querySelector('.stats-section');
        statsSection.classList.add('looping');
        setTimeout(() => statsSection.classList.remove('looping'), 1000);
        
        updateLoopCountDisplay();
    }
    
    // 現在位置表示を更新
    elements.currentPosition.textContent = formatTime(currentTime);
}

/**
 * 統計を更新
 */
function updateStats() {
    if (!isPlaying) return;
    
    totalSeconds++;
    elements.totalTime.textContent = formatTime(totalSeconds, true);
}

/**
 * ループ回数表示を更新
 */
function updateLoopCountDisplay() {
    elements.loopCount.textContent = loopCount.toLocaleString();
}

/**
 * 一時停止
 */
function pauseEndurance() {
    if (!player) return;
    
    isPlaying = false;
    player.pauseVideo();
    
    if (loopInterval) {
        clearInterval(loopInterval);
        loopInterval = null;
    }
    if (statsInterval) {
        clearInterval(statsInterval);
        statsInterval = null;
    }
    
    elements.playBtn.innerHTML = '<span class="btn-icon">▶️</span><span>再開</span>';
    showToast('一時停止中 ⏸️');
}

/**
 * リセット
 */
function resetEndurance() {
    pauseEndurance();
    
    loopCount = 0;
    totalSeconds = 0;
    
    elements.loopCount.textContent = '0';
    elements.totalTime.textContent = '00:00:00';
    elements.currentPosition.textContent = '00:00';
    elements.playBtn.innerHTML = '<span class="btn-icon">▶️</span><span>耐久開始</span>';
    
    if (player && isPlayerReady) {
        player.seekTo(getStartTime(), true);
        player.pauseVideo();
    }
    
    showToast('リセットしました 🔄');
}

/**
 * 現在の再生位置を開始時間に設定
 */
function setStartFromCurrent() {
    if (!player || !isPlayerReady) return;
    
    const currentTime = player.getCurrentTime();
    elements.startMin.value = Math.floor(currentTime / 60);
    elements.startSec.value = Math.floor(currentTime % 60);
    updateLoopDurationDisplay();
    updateJsonPreview();
    showToast('開始時間を設定しました ✅');
}

/**
 * 現在の再生位置を終了時間に設定
 */
function setEndFromCurrent() {
    if (!player || !isPlayerReady) return;
    
    const currentTime = player.getCurrentTime();
    elements.endMin.value = Math.floor(currentTime / 60);
    elements.endSec.value = Math.floor(currentTime % 60);
    updateLoopDurationDisplay();
    updateJsonPreview();
    showToast('終了時間を設定しました ✅');
}

/**
 * 現在の設定をJSON形式で取得
 */
function getConfigJson() {
    return {
        videoId: currentVideoId,
        videoUrl: elements.youtubeUrl.value,
        startTime: getStartTime(),
        endTime: getEndTime(),
        loopDuration: getEndTime() - getStartTime(),
        // 統計情報も含める（オプション）
        stats: {
            loopCount: loopCount,
            totalSeconds: totalSeconds
        },
        createdAt: new Date().toISOString()
    };
}

/**
 * JSONプレビューを更新
 */
function updateJsonPreview() {
    const config = getConfigJson();
    elements.jsonPreview.value = JSON.stringify(config, null, 2);
}

/**
 * JSONをクリップボードにコピー
 */
function exportJsonToClipboard() {
    const config = getConfigJson();
    const jsonString = JSON.stringify(config, null, 2);
    
    navigator.clipboard.writeText(jsonString)
        .then(() => showToast('JSONをコピーしました！📋'))
        .catch(() => {
            // フォールバック
            elements.jsonPreview.select();
            document.execCommand('copy');
            showToast('JSONをコピーしました！📋');
        });
}

/**
 * JSONインポートエリアを表示/非表示
 */
function toggleImportContainer() {
    elements.importContainer.classList.toggle('hidden');
    if (!elements.importContainer.classList.contains('hidden')) {
        elements.jsonInput.focus();
    }
}

/**
 * JSONから設定を適用
 */
function applyJsonConfig() {
    try {
        const jsonString = elements.jsonInput.value.trim();
        if (!jsonString) {
            showToast('JSONを入力してください ⚠️');
            return;
        }
        
        const config = JSON.parse(jsonString);
        
        // URLまたは動画ID
        if (config.videoUrl) {
            elements.youtubeUrl.value = config.videoUrl;
        } else if (config.videoId) {
            elements.youtubeUrl.value = `https://www.youtube.com/watch?v=${config.videoId}`;
        }
        
        // ループ区間
        if (typeof config.startTime === 'number') {
            elements.startMin.value = Math.floor(config.startTime / 60);
            elements.startSec.value = Math.floor(config.startTime % 60);
        }
        
        if (typeof config.endTime === 'number') {
            elements.endMin.value = Math.floor(config.endTime / 60);
            elements.endSec.value = Math.floor(config.endTime % 60);
        }
        
        updateLoopDurationDisplay();
        
        // 動画を読み込む
        const videoId = extractVideoId(elements.youtubeUrl.value);
        if (videoId) {
            initPlayer(videoId);
        }
        
        elements.importContainer.classList.add('hidden');
        elements.jsonInput.value = '';
        
        showToast('設定を適用しました！✨');
    } catch (e) {
        console.error('JSON parse error:', e);
        showToast('JSONの形式が正しくありません ❌');
    }
}

/**
 * トースト通知を表示
 */
function showToast(message) {
    elements.toastMessage.textContent = message;
    elements.toast.classList.add('show');
    elements.toast.classList.remove('hidden');
    
    setTimeout(() => {
        elements.toast.classList.remove('show');
    }, 3000);
}

/**
 * 動画を読み込み
 */
function loadVideo() {
    const url = elements.youtubeUrl.value.trim();
    const videoId = extractVideoId(url);
    
    if (!videoId) {
        showToast('有効なYouTube URLを入力してください ⚠️');
        return;
    }
    
    initPlayer(videoId);
}

// イベントリスナーの設定
document.addEventListener('DOMContentLoaded', () => {
    // 動画読み込み
    elements.loadVideo.addEventListener('click', loadVideo);
    elements.youtubeUrl.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') loadVideo();
    });
    
    // ループ区間設定
    elements.setStartCurrent.addEventListener('click', setStartFromCurrent);
    elements.setEndCurrent.addEventListener('click', setEndFromCurrent);
    
    // 時間入力変更時にプレビュー更新
    [elements.startMin, elements.startSec, elements.endMin, elements.endSec].forEach(el => {
        el.addEventListener('change', () => {
            updateLoopDurationDisplay();
            updateJsonPreview();
        });
    });
    
    // コントロールボタン
    elements.playBtn.addEventListener('click', () => {
        if (isPlaying) {
            // 再生中なら何もしない（または再スタート）
            return;
        }
        startEndurance();
    });
    elements.pauseBtn.addEventListener('click', pauseEndurance);
    elements.resetBtn.addEventListener('click', resetEndurance);
    
    // JSON共有
    elements.exportJson.addEventListener('click', exportJsonToClipboard);
    elements.importJson.addEventListener('click', toggleImportContainer);
    elements.applyJson.addEventListener('click', applyJsonConfig);
    
    // 初期JSONプレビュー
    updateJsonPreview();
});

// ページ離脱時の警告
window.addEventListener('beforeunload', (e) => {
    if (isPlaying || loopCount > 0) {
        e.preventDefault();
        e.returnValue = '';
    }
});
