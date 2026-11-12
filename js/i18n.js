// 日本語 / English
const DICT = {
  ja: {
    'btn.pause': '一時停止', 'btn.play': 'プレイ', 'btn.howto': 'あそびかた', 'btn.back': '戻る', 'btn.toTitle': 'トップに戻る',
    'setup.title': '釣りの準備',
    'pause.title': '一時停止', 'pause.resume': '再開', 'pause.end': '釣りを終える',
    'over.title': '本日の釣果', 'over.again': 'もう一度', 'over.share': 'シェア', 'over.count': '{n} 尾',
    'over.redo': '広告で掛け直し：{n} 回', 'over.none': 'まだ釣果はありません。もう一度挑戦しよう！',
    'over.best': '最大', 'over.species': '魚種', 'over.num': '数',
    'legal.privacy': 'プライバシーポリシー', 'legal.adSettings': '広告の設定', 'url.privacy': 'https://techgym.jp/privacy-policy/',
    'title.best': 'ハイスコア {s} pt ／ 図鑑 {n} / {total} 種',
    'redo.watch': '広告を見て掛け直す', 'redo.next': '次へ（{s}）', 'redo.note': '逃した魚をもう一度掛ける（残り {n} / {max} 回）',
    'redo.loading': '広告を読み込み中…', 'redo.fail': '広告を読み込めませんでした',
    'msg.redo': '掛け直した！ 今度は逃がすな！',
    'share.text': '渓流釣りで {n} 尾・{s} pt！{best}', 'share.best': '最大は{fish} {size}cm。', 'share.redo': '（掛け直し {r} 回）', 'share.tag': ' #渓流釣り', 'share.dialog': '釣果をシェア',
    'hint.idle.touch': '水面をタップして振り込み　｜　◀ ▶ ボタンで移動',
    'msg.driftEnd.touch': '流しきり — 水面をタップして振り込み直そう',
    'msg.outOfReach.touch': 'そこには届かない（川の中・約2〜10m）',
    'msg.whiff.touch': '空振り…　目印が動いてから「合わせ」ボタン',
    'hint.drift.touch': '目印が動いたら 合わせボタン か 画面をタップ！',
    'hint.fight.touch': '画面か合わせボタンを長押しで寄せる ／ 離していなす',
    'hint.tomo.idle.touch': '瀬をタップして、おとりを送り出す　｜　◀ ▶ ボタンで移動',
    'hint.tomo.drift.touch': 'タップした所へおとりが泳ぐ。アユの縄張りへ送り込もう　｜　回収ボタンで回収',
    'help.keys.touch': '<tr><td>水面をタップ</td><td>振り込み（友釣りはおとりを泳がせる）</td></tr><tr><td>合わせボタン</td><td>合わせ（友釣りは回収）／長押しで寄せ</td></tr><tr><td>◀ 上流 ／ 下流 ▶</td><td>移動</td></tr><tr><td>2本指ドラッグ ／ ピンチ</td><td>視点の回転 ／ ズーム</td></tr>',
    'title': '渓流釣り',
    'title.sub': '山あいの清流で、ヤマメ・イワナを目印釣りで、アユを友釣りで狙う。',
    'opt.method': '釣り方', 'method.bait': 'エサ釣り', 'method.tomo': '友釣り（アユ）',
    'opt.time': '時間帯', 'time.morning': '朝マズメ', 'time.noon': '日中', 'time.evening': '夕マズメ',
    'opt.season': '季節', 'season.spring': '新緑', 'season.summer': '盛夏', 'season.autumn': '紅葉',
    'start': '釣りを始める',
    'title.tip': 'マズメ時は魚の活性が高く、アタリが多くなります。',
    'title.tomoNote': '友釣りは新緑・盛夏のみ（アユの季節）。',
    'btn.zukan': '図鑑', 'btn.log': '釣果記録', 'btn.help': '操作', 'btn.lang': 'English',
    'btn.sound.on': '音 ON', 'btn.sound.off': '音 OFF', 'btn.bgm.on': 'BGM ON', 'btn.bgm.off': 'BGM OFF',
    'btn.close': '閉じる', 'btn.up': '◀ 上流', 'btn.down': '下流 ▶', 'btn.strike': '合わせ', 'btn.strike.sub': '長押しで寄せ',
    'btn.strike.tomo': '回収', 'btn.strike.tomo.sub': '長押しで寄せ',
    'hud.catch': '釣果', 'hud.unit': '尾', 'hud.tension': 'テンション', 'hud.stamina': '魚の体力', 'hud.vigor': 'おとりの元気',
    'bite': 'アタリ！', 'hit': 'ガツン！',
    'load.terrain': '地形を生成中…', 'load.rocks': '岩を配置中…', 'load.forest': '森を育てています…',
    'load.river': '川を流しています…', 'load.fish': '魚を放流中…', 'load.fail': '読み込みに失敗しました: {msg}', 'load.init': '読み込み中…',
    'hint.idle': '水面をクリックして振り込み　｜　A / D：移動',
    'hint.drift': '目印に集中…　目印が動いたら クリック / スペース で合わせ！',
    'hint.fight': '長押しで寄せる ／ 離していなす',
    'hint.landing': 'タモ入れ！',
    'hint.tomo.idle': '瀬（浅く流れの速い所）をクリックして、おとりを送り出す　｜　A / D：移動',
    'hint.tomo.drift': 'クリックした所へおとりが泳ぐ。アユの縄張りへ送り込もう　｜　スペース：回収',
    'msg.outOfReach': 'そこには届かない（川の中・約2〜10m）',
    'msg.pullOut': 'すっぽ抜け！', 'msg.whiff': '空振り…　目印が動いてから合わせよう',
    'msg.driftEnd': '流しきり — 水面をクリックして振り込み直そう',
    'msg.baitStolen': 'エサを取られた…　振り込み直そう', 'msg.late': '合わせ遅れ！',
    'msg.break': '糸が切れた！　引きが強い時は力を抜こう', 'msg.lost': 'バラした…　糸を張り気味に保とう',
    'msg.kept': 'ビクに入れた', 'msg.released': 'リリースした（+10%ボーナス）',
    'msg.start': '{season}の渓流・{time}。良い釣りを！',
    'msg.tomo.start': '{season}の渓流・{time}。友釣りスタート — 瀬にいるアユの縄張りへおとりを送り込もう',
    'msg.tomo.hit': 'ガツン！ 野アユが掛かった！', 'msg.tomo.miss': '体当たり！…掛からなかった',
    'msg.tomo.tired': 'おとりが弱ってきた… 回収して休ませるか、釣れたアユと交代しよう',
    'msg.tomo.retrieved': 'おとりを回収した（休ませると元気が戻る）',
    'msg.tomo.newOtori': '元気な野アユをおとりにした！',
    'msg.tomo.lostOtori': '糸と一緒におとりも失った… 新しい養殖おとりを付けた',
    'res.caught': '釣り上げた！', 'res.weight': '約 {g} g', 'res.shaku': '尺物！', 'res.record': '自己記録更新', 'res.new': '図鑑に登録！',
    'res.release': 'リリース', 'res.keep': 'キープ', 'res.otori': 'おとりにする',
    'log.title': '釣果記録', 'log.species': '魚種', 'log.now': '今回', 'log.best': '自己記録',
    'log.hiscore': 'ハイスコア: <b>{s}</b> pt ／ 通算 {n} 尾', 'log.recent': '今回の釣果', 'log.none': 'まだ釣果はありません',
    'log.keep': '（キープ）', 'log.release': '（リリース）', 'log.otori': '（おとり）', 'log.count': '{n} 尾',
    'zukan.title': '魚図鑑', 'zukan.progress': '登録 {n} / {total} 種', 'zukan.unknown': '？？？',
    'zukan.hint.bait': 'エサ釣りで釣れる', 'zukan.hint.tomo': '友釣りでしか釣れない',
    'zukan.size': '大きさ', 'zukan.best': '最大', 'zukan.total': '釣った数', 'zukan.where': 'よくいる場所',
    'help.title': '遊び方',
    'help.body': `<h3>エサ釣り</h3><ol>
      <li><b>振り込み</b>：水面にカーソルを合わせ（緑の輪）クリック／タップ。</li>
      <li><b>流し</b>：仕掛けは流れに乗って下ります。岩の裏や淵（深くて緑の濃い所）に魚が潜んでいます。</li>
      <li><b>合わせ</b>：目印がピクッと動いたら（アタリ！）すかさず クリック／スペース。</li>
      <li><b>やり取り</b>：押し続けると竿を立てて寄せ、離すと引きをいなします。テンションが赤だと糸切れ、低すぎるとバラシ。</li>
      <li><b>取り込み</b>：魚の体力を削って手前まで寄せると自動でタモ入れ。</li></ol>
      <h3>友釣り（アユ）</h3><ol>
      <li>瀬（浅く流れの速い所）をクリックして、おとりのアユを送り出す。</li>
      <li>水面をクリックすると、おとりがそこへ泳ぎます。アユの縄張りに入ると、野アユが体当たりして掛け針に掛かります（合わせ不要）。</li>
      <li>おとりは泳ぐほど弱ります。スペースで回収して休ませるか、釣れたアユを新しいおとりにしましょう。</li></ol>`,
    'help.body.touch': `<h3>エサ釣り</h3><ol>
      <li><b>振り込み</b>：水面をタップ（緑の輪の所に落ちる）。</li>
      <li><b>流し</b>：仕掛けは流れに乗って下ります。岩の裏や淵（深くて緑の濃い所）に魚が潜んでいます。</li>
      <li><b>合わせ</b>：目印がピクッと動いたら（アタリ！）すかさず「合わせ」ボタンか画面をタップ。</li>
      <li><b>やり取り</b>：長押しすると竿を立てて寄せ、離すと引きをいなします。テンションが赤だと糸切れ、低すぎるとバラシ。</li>
      <li><b>取り込み</b>：魚の体力を削って手前まで寄せると自動でタモ入れ。</li></ol>
      <h3>友釣り（アユ）</h3><ol>
      <li>瀬（浅く流れの速い所）をタップして、おとりのアユを送り出す。</li>
      <li>水面をタップすると、おとりがそこへ泳ぎます。アユの縄張りに入ると、野アユが体当たりして掛け針に掛かります（合わせ不要）。</li>
      <li>おとりは泳ぐほど弱ります。「回収」ボタンで回収して休ませるか、釣れたアユを新しいおとりにしましょう。</li></ol>`,
    'help.keys': '<tr><td>A / ←</td><td>上流へ移動</td></tr><tr><td>D / →</td><td>下流へ移動</td></tr><tr><td>右ドラッグ / Q・E</td><td>視点の回転</td></tr><tr><td>ホイール / ピンチ</td><td>ズーム</td></tr><tr><td>スペース</td><td>合わせ（友釣りは回収）／長押しで寄せ</td></tr>',
    'help.tip': '魚は人の気配や着水音に敏感です。歩いて近づきすぎると逃げてしまいます。上流には滝と滝壺があります。',
    'fish.yamame.name': 'ヤマメ', 'fish.yamame.desc': '渓流の女王。体側のパーマークが美しい。警戒心が強く、アタリは一瞬。', 'fish.yamame.where': '瀬・淵の頭',
    'fish.iwana.name': 'イワナ', 'fish.iwana.desc': '源流の主。岩陰や滝壺に潜み、エサをしっかり咥える。', 'fish.iwana.where': '岩陰・滝壺（上流）',
    'fish.niji.name': 'ニジマス', 'fish.niji.desc': '強烈な引きとジャンプ。体側の虹色の帯が特徴。', 'fish.niji.where': '深い淵',
    'fish.ayu.name': 'アユ', 'fish.ayu.desc': '清流の女王・香魚。瀬の苔を食み、縄張りに入ったおとりに体当たりする。友釣りでしか釣れない。', 'fish.ayu.where': '瀬（縄張り）',
    'fish.ugui.name': 'ウグイ', 'fish.ugui.desc': '渓流の外道の代表格。よくエサをつつく。', 'fish.ugui.where': '瀬・浅い流れ',
  },
  en: {
    'btn.pause': 'Pause', 'btn.play': 'Play', 'btn.howto': 'How to play', 'btn.back': 'Back', 'btn.toTitle': 'Back to top',
    'setup.title': 'Get ready',
    'pause.title': 'Paused', 'pause.resume': 'Resume', 'pause.end': 'Finish fishing',
    'over.title': "Today's catch", 'over.again': 'Play again', 'over.share': 'Share', 'over.count': '{n} fish',
    'over.redo': 'Re-hooked with ads: {n}', 'over.none': 'No catches yet. Try again!',
    'over.best': 'Biggest', 'over.species': 'Species', 'over.num': 'Count',
    'legal.privacy': 'Privacy policy', 'legal.adSettings': 'Ad settings', 'url.privacy': 'https://techgym.jp/privacy-policy-en/',
    'title.best': 'High score {s} pt / Fish book {n} / {total}',
    'redo.watch': 'Watch an ad to re-hook', 'redo.next': 'Skip ({s})', 'redo.note': 'Hook the one that got away again ({n} / {max} left)',
    'redo.loading': 'Loading ad…', 'redo.fail': 'Could not load an ad',
    'msg.redo': 'Re-hooked! Don\'t let it go this time!',
    'share.text': 'I caught {n} fish for {s} pt in Keiryu! {best}', 'share.best': 'Biggest: {fish} {size} cm.', 'share.redo': ' (re-hooked {r}x)', 'share.tag': ' #Keiryu', 'share.dialog': 'Share your catch',
    'hint.idle.touch': 'Tap the water to cast  |  ◀ ▶ buttons: walk',
    'msg.driftEnd.touch': 'End of the drift — tap the water to cast again',
    'msg.outOfReach.touch': 'Out of reach (in the river, about 2–10 m)',
    'msg.whiff.touch': 'Missed… press Strike after the markers twitch',
    'hint.drift.touch': 'When the markers twitch, tap the Strike button or the screen!',
    'hint.fight.touch': 'Hold the screen or Strike to pull in / release to give line',
    'hint.tomo.idle.touch': 'Tap a riffle to send out the decoy  |  ◀ ▶ buttons: walk',
    'hint.tomo.drift.touch': 'Tap to steer the decoy into an ayu territory  |  Retrieve button: retrieve',
    'help.keys.touch': '<tr><td>Tap the water</td><td>Cast (steer the decoy in tomozuri)</td></tr><tr><td>Strike button</td><td>Strike (retrieve in tomozuri) / hold to pull</td></tr><tr><td>◀ Upstream / Downstream ▶</td><td>Walk</td></tr><tr><td>Two-finger drag / pinch</td><td>Rotate / zoom camera</td></tr>',
    'title': 'Keiryu',
    'title.sub': 'Fish a clear mountain stream in Japan — yamame and iwana with drift bait, ayu with a live decoy.',
    'opt.method': 'Method', 'method.bait': 'Bait drift', 'method.tomo': 'Tomozuri (ayu)',
    'opt.time': 'Time of day', 'time.morning': 'Dawn', 'time.noon': 'Midday', 'time.evening': 'Dusk',
    'opt.season': 'Season', 'season.spring': 'Spring', 'season.summer': 'Summer', 'season.autumn': 'Autumn',
    'start': 'Start fishing',
    'title.tip': 'Fish are most active at dawn and dusk.',
    'title.tomoNote': 'Tomozuri is only in spring and summer (ayu season).',
    'btn.zukan': 'Fish book', 'btn.log': 'Catches', 'btn.help': 'Controls', 'btn.lang': '日本語',
    'btn.sound.on': 'Sound ON', 'btn.sound.off': 'Sound OFF', 'btn.bgm.on': 'Music ON', 'btn.bgm.off': 'Music OFF',
    'btn.close': 'Close', 'btn.up': '◀ Upstream', 'btn.down': 'Downstream ▶', 'btn.strike': 'Strike', 'btn.strike.sub': 'hold to reel',
    'btn.strike.tomo': 'Retrieve', 'btn.strike.tomo.sub': 'hold to reel',
    'hud.catch': 'Catch', 'hud.unit': '', 'hud.tension': 'Tension', 'hud.stamina': 'Fish stamina', 'hud.vigor': 'Decoy energy',
    'bite': 'BITE!', 'hit': 'HIT!',
    'load.terrain': 'Shaping the valley…', 'load.rocks': 'Placing rocks…', 'load.forest': 'Growing the forest…',
    'load.river': 'Filling the river…', 'load.fish': 'Releasing fish…', 'load.fail': 'Failed to load: {msg}', 'load.init': 'Loading…',
    'hint.idle': 'Click the water to cast  |  A / D: walk',
    'hint.drift': 'Watch the markers… strike with click / Space when they twitch!',
    'hint.fight': 'Hold to pull in / release to give line',
    'hint.landing': 'Netting!',
    'hint.tomo.idle': 'Click a riffle (shallow, fast water) to send out the decoy  |  A / D: walk',
    'hint.tomo.drift': 'Click to steer the decoy into an ayu territory  |  Space: retrieve',
    'msg.outOfReach': 'Out of reach (in the river, about 2–10 m)',
    'msg.pullOut': 'The hook pulled out!', 'msg.whiff': 'Missed… wait for the markers to twitch',
    'msg.driftEnd': 'End of the drift — click the water to cast again',
    'msg.baitStolen': 'Bait stolen… cast again', 'msg.late': 'Too late!',
    'msg.break': 'Line snapped! Ease off when the fish runs hard', 'msg.lost': 'The fish got off… keep the line tight',
    'msg.kept': 'Into the creel', 'msg.released': 'Released (+10% bonus)',
    'msg.start': '{season} stream, {time}. Good luck!',
    'msg.tomo.start': '{season} stream, {time}. Tomozuri — steer your decoy into an ayu territory in the riffles',
    'msg.tomo.hit': 'HIT! A wild ayu is hooked!', 'msg.tomo.miss': 'It rammed the decoy… but missed the hooks',
    'msg.tomo.tired': 'Your decoy is tiring… retrieve it to rest, or swap in a fresh catch',
    'msg.tomo.retrieved': 'Decoy retrieved (it recovers while resting)',
    'msg.tomo.newOtori': 'A fresh wild ayu is your new decoy!',
    'msg.tomo.lostOtori': 'Lost the decoy with the line… rigged a new farmed decoy',
    'res.caught': 'Caught!', 'res.weight': 'about {g} g', 'res.shaku': 'Shakumono! (30 cm+)', 'res.record': 'New personal best', 'res.new': 'New entry in the fish book!',
    'res.release': 'Release', 'res.keep': 'Keep', 'res.otori': 'Use as decoy',
    'log.title': 'Catches', 'log.species': 'Species', 'log.now': 'This trip', 'log.best': 'Personal best',
    'log.hiscore': 'High score: <b>{s}</b> pt / {n} fish all-time', 'log.recent': 'This trip', 'log.none': 'No catches yet',
    'log.keep': '(kept)', 'log.release': '(released)', 'log.otori': '(decoy)', 'log.count': '{n}',
    'zukan.title': 'Fish book', 'zukan.progress': '{n} / {total} species found', 'zukan.unknown': '???',
    'zukan.hint.bait': 'Caught by bait drifting', 'zukan.hint.tomo': 'Only caught by tomozuri',
    'zukan.size': 'Size', 'zukan.best': 'Biggest', 'zukan.total': 'Caught', 'zukan.where': 'Found in',
    'help.title': 'How to play',
    'help.body': `<h3>Bait drifting</h3><ol>
      <li><b>Cast</b>: point at the water (green ring) and click / tap.</li>
      <li><b>Drift</b>: the bait drifts with the current. Fish hide behind rocks and in deep green pools.</li>
      <li><b>Strike</b>: when the coloured markers twitch (BITE!), click / press Space right away.</li>
      <li><b>Fight</b>: hold to raise the rod and pull, release to give. Red tension snaps the line; too slack and the fish gets off.</li>
      <li><b>Land</b>: wear the fish out and bring it close — it goes into the net automatically.</li></ol>
      <h3>Tomozuri (ayu)</h3><ol>
      <li>Click a riffle (shallow, fast water) to send out your live decoy ayu.</li>
      <li>Click the water to make the decoy swim there. Wild ayu defend territories and ram intruders — they get caught on the hooks behind the decoy (no strike needed).</li>
      <li>The decoy tires as it swims. Press Space to retrieve and rest it, or use a fresh catch as the new decoy.</li></ol>`,
    'help.body.touch': `<h3>Bait drifting</h3><ol>
      <li><b>Cast</b>: tap the water (the bait lands on the green ring).</li>
      <li><b>Drift</b>: the bait drifts with the current. Fish hide behind rocks and in deep green pools.</li>
      <li><b>Strike</b>: when the coloured markers twitch (BITE!), tap the Strike button or the screen right away.</li>
      <li><b>Fight</b>: hold the screen or Strike to raise the rod and pull, release to give. Red tension snaps the line; too slack and the fish gets off.</li>
      <li><b>Land</b>: wear the fish out and bring it close — it goes into the net automatically.</li></ol>
      <h3>Tomozuri (ayu)</h3><ol>
      <li>Tap a riffle (shallow, fast water) to send out your live decoy ayu.</li>
      <li>Tap the water to make the decoy swim there. Wild ayu defend territories and ram intruders — they get caught on the hooks behind the decoy (no strike needed).</li>
      <li>The decoy tires as it swims. Press Retrieve and rest it, or use a fresh catch as the new decoy.</li></ol>`,
    'help.keys': '<tr><td>A / ←</td><td>Walk upstream</td></tr><tr><td>D / →</td><td>Walk downstream</td></tr><tr><td>Right-drag / Q·E</td><td>Rotate camera</td></tr><tr><td>Wheel / pinch</td><td>Zoom</td></tr><tr><td>Space</td><td>Strike (retrieve in tomozuri) / hold to pull</td></tr>',
    'help.tip': 'Fish are wary of footsteps and splashes — walking too close scares them off. There is a waterfall upstream.',
    'fish.yamame.name': 'Yamame', 'fish.yamame.desc': 'Queen of the mountain stream, with beautiful parr marks. Very wary — the bite lasts an instant.', 'fish.yamame.where': 'Riffles, heads of pools',
    'fish.iwana.name': 'Iwana', 'fish.iwana.desc': 'Lord of the headwaters. Lurks behind rocks and in plunge pools, and holds the bait firmly.', 'fish.iwana.where': 'Behind rocks, plunge pool',
    'fish.niji.name': 'Rainbow trout', 'fish.niji.desc': 'Powerful runs and leaps. Known for the rainbow band on its flank.', 'fish.niji.where': 'Deep pools',
    'fish.ayu.name': 'Ayu', 'fish.ayu.desc': 'The "sweetfish". Grazes algae in the riffles and rams any decoy that enters its territory. Only caught by tomozuri.', 'fish.ayu.where': 'Riffles (territories)',
    'fish.ugui.name': 'Ugui (dace)', 'fish.ugui.desc': 'The classic by-catch of mountain streams. Nibbles at everything.', 'fish.ugui.where': 'Riffles, shallow runs',
  },
};

let lang = 'ja';
try {
  const saved = localStorage.getItem('keiryu.lang');
  lang = saved || (navigator.language && !navigator.language.startsWith('ja') ? 'en' : 'ja');
} catch (e) { /* ignore */ }

export function getLang() { return lang; }
export function t(key, params) {
  let s = DICT[lang][key] ?? DICT.ja[key] ?? key;
  if (params) for (const k in params) s = s.replaceAll('{' + k + '}', params[k]);
  return s;
}
// タッチ操作の端末では、あれば '.touch' の文言を使う
const TOUCH = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
export function tt(key, params) {
  return TOUCH && (DICT[lang][key + '.touch'] || DICT.ja[key + '.touch']) ? t(key + '.touch', params) : t(key, params);
}
export function fishName(key) { return t('fish.' + key + '.name'); }

const listeners = [];
export function onLangChange(fn) { listeners.push(fn); }
export function setLang(l) {
  lang = l;
  try { localStorage.setItem('keiryu.lang', l); } catch (e) { /* ignore */ }
  applyStatic();
  listeners.forEach((fn) => fn(l));
}
export function applyStatic(root = document) {
  document.documentElement.lang = lang;
  document.title = lang === 'ja' ? '渓流釣り' : 'Keiryu — Mountain Stream Fishing';
  root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-html]').forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml); });
}
