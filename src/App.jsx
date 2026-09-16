import React, { useEffect, useRef, useState, useCallback } from "react";
import "./App.css";
import logo1Src from "./assets/logo1.png";
import logo2Src from "./assets/logo2.png";

const LOREM = {
  logo1: [
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
  ],
  logo2: [
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Duis aute irure dolor in reprehenderit in voluptate velit esse.",
    "Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.",
  ],
};

const LW = 300, LH = 440;
const PADDLE_R = 30, PUCK_R = 12, GOAL_HALF = 55;
const WIN_SCORE = 5;

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function freshGameState() {
  return {
    mode: null,
    running: false,
    names: { p1: "Ти", p2: "Бот" },
    scores: { p1: 0, p2: 0 },
    p1: { x: LW / 2, y: LH - 70, prevX: LW / 2, prevY: LH - 70, vx: 0, vy: 0 },
    p2: { x: LW / 2, y: 70, prevX: LW / 2, prevY: 70, vx: 0, vy: 0 },
    puck: { x: LW / 2, y: LH / 2, vx: 0, vy: 0 },
    pointers: {},
  };
}

export default function App() {
  const [screen, setScreen] = useState("home"); // "home" | "game"
  const [leaving, setLeaving] = useState(false);
  const [drawn, setDrawn] = useState(false);
  const [hoverKey, setHoverKey] = useState(null); // "logo1" | "logo2" | null
  const [overlay, setOverlay] = useState(null); // "mode" | "end" | null
  const [scoreVisible, setScoreVisible] = useState(false);
  const [names, setNames] = useState({ p1: "Ти", p2: "Бот" });
  const [scores, setScores] = useState({ p1: 0, p2: 0 });
  const [endText, setEndText] = useState("");
  const [flashText, setFlashText] = useState("");
  const [flashShow, setFlashShow] = useState(false);
  const [roundText, setRoundText] = useState("Рухай свій логотип по своїй половині поля");
  const [roundVisible, setRoundVisible] = useState(true);

  const canvasRef = useRef(null);
  const img1Ref = useRef(null);
  const img2Ref = useRef(null);
  const clickTimesRef = useRef([]);
  const gRef = useRef(freshGameState());
  const rafRef = useRef(null);

  // preload paddle images once
  useEffect(() => {
    const i1 = new Image();
    const i2 = new Image();
    i1.src = logo1Src;
    i2.src = logo2Src;
    img1Ref.current = i1;
    img2Ref.current = i2;
    const redraw = () => draw();
    i1.onload = redraw;
    i2.onload = redraw;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- hover veil (whole-page blur) ---------------- */
  const handleEnter = (key) => setHoverKey(key);
  const handleLeave = () => setHoverKey(null);

  /* ---------------- secret: 5 rapid clicks on logo2 ---------------- */
  const handleLogo2Click = () => {
    const now = Date.now();
    const times = clickTimesRef.current.filter((t) => now - t < 2200);
    times.push(now);
    clickTimesRef.current = times;
    if (times.length >= 5) {
      clickTimesRef.current = [];
      enterGame();
    }
  };

  const enterGame = () => {
    setHoverKey(null);
    setLeaving(true);
    setTimeout(() => {
      setScreen("game");
      requestAnimationFrame(() => setDrawn(true));
      setTimeout(() => setOverlay("mode"), 650);
      setTimeout(() => setRoundVisible(false), 3200);
    }, 480);
  };

  const goHome = () => {
    stopGame();
    setOverlay(null);
    setScoreVisible(false);
    setDrawn(false);
    setScreen("home");
    setRoundVisible(true);
    setRoundText("Рухай свій логотип по своїй половині поля");
    requestAnimationFrame(() => setLeaving(false));
  };

  /* =====================  AIR HOCKEY  ===================== */

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    canvas.width = LW * dpr;
    canvas.height = LH * dpr;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }, []);

  useEffect(() => {
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, [resizeCanvas]);

  const toLocal = (clientX, clientY) => {
    const canvas = canvasRef.current;
    const r = canvas.getBoundingClientRect();
    return {
      x: (clientX - r.left) * (LW / r.width),
      y: (clientY - r.top) * (LH / r.height),
    };
  };

  const onPointerDown = (e) => {
    const canvas = canvasRef.current;
    const G = gRef.current;
    const p = toLocal(e.clientX, e.clientY);
    const half = p.y < LH / 2 ? "p2" : "p1";
    if (half === "p1") {
      G.pointers[e.pointerId] = "p1";
      canvas.setPointerCapture(e.pointerId);
    } else if (G.mode === "friend") {
      G.pointers[e.pointerId] = "p2";
      canvas.setPointerCapture(e.pointerId);
    }
  };
  const onPointerMove = (e) => {
    const G = gRef.current;
    const who = G.pointers[e.pointerId];
    if (!who) return;
    const p = toLocal(e.clientX, e.clientY);
    const paddle = G[who];
    paddle.x = clamp(p.x, PADDLE_R, LW - PADDLE_R);
    if (who === "p1") {
      paddle.y = clamp(p.y, LH / 2 + PADDLE_R, LH - PADDLE_R);
    } else {
      paddle.y = clamp(p.y, PADDLE_R, LH / 2 - PADDLE_R);
    }
  };
  const releasePointer = (e) => {
    delete gRef.current.pointers[e.pointerId];
  };

  const serve = (towardTop) => {
    const G = gRef.current;
    const angle = Math.random() * 0.9 - 0.45;
    const speed = 3.4;
    const dir = towardTop ? -1 : 1;
    G.puck.x = LW / 2;
    G.puck.y = LH / 2;
    G.puck.vx = Math.sin(angle) * speed;
    G.puck.vy = Math.cos(angle) * speed * dir;
  };

  const startGame = (mode) => {
    const G = freshGameState();
    G.mode = mode;
    G.names.p1 = "Ти";
    G.names.p2 = mode === "bot" ? "Бот" : "Гравець 2";
    gRef.current = G;
    setNames(G.names);
    setScores({ p1: 0, p2: 0 });
    setScoreVisible(true);
    setOverlay(null);
    setRoundText(
      mode === "friend"
        ? "Кожен керує своїм лого у своїй половині"
        : "Керуй лого знизу — бот грає зверху"
    );
    setRoundVisible(true);
    serve(Math.random() < 0.5);
    G.running = true;
    rafRef.current = requestAnimationFrame(loop);
  };

  const stopGame = () => {
    gRef.current.running = false;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  };

  const handleGoal = (scorer) => {
    const G = gRef.current;
    G.scores[scorer]++;
    setScores({ ...G.scores });
    setFlashText("ГОЛ — " + G.names[scorer] + "!");
    setFlashShow(true);
    setTimeout(() => setFlashShow(false), 900);

    if (G.scores.p1 >= WIN_SCORE || G.scores.p2 >= WIN_SCORE) {
      stopGame();
      const winner = G.scores.p1 > G.scores.p2 ? G.names.p1 : G.names.p2;
      setEndText(
        winner +
          " перемагає з рахунком " +
          Math.max(G.scores.p1, G.scores.p2) +
          " : " +
          Math.min(G.scores.p1, G.scores.p2) +
          "!"
      );
      setTimeout(() => setOverlay("end"), 650);
      return;
    }
    G.puck.x = LW / 2;
    G.puck.y = LH / 2;
    G.puck.vx = 0;
    G.puck.vy = 0;
    setTimeout(() => {
      if (G.running) serve(scorer === "p1");
    }, 700);
  };

  const updateAI = () => {
    const G = gRef.current;
    if (G.mode !== "bot") return;
    const bot = G.p2;
    const targetX = clamp(G.puck.x, PADDLE_R, LW - PADDLE_R);
    bot.x += (targetX - bot.x) * 0.1;
    const advanceY = LH / 2 - PADDLE_R - 12;
    const defaultY = PADDLE_R + 46;
    const targetY = G.puck.y < LH / 2 ? advanceY : defaultY;
    bot.y += (targetY - bot.y) * 0.06;
    bot.y = clamp(bot.y, PADDLE_R, LH / 2 - PADDLE_R);
    bot.x = clamp(bot.x, PADDLE_R, LW - PADDLE_R);
  };

  const step = () => {
    const G = gRef.current;
    ["p1", "p2"].forEach((k) => {
      const pd = G[k];
      pd.vx = pd.x - pd.prevX;
      pd.vy = pd.y - pd.prevY;
      pd.prevX = pd.x;
      pd.prevY = pd.y;
    });
    updateAI();

    const puck = G.puck;
    puck.x += puck.vx;
    puck.y += puck.vy;
    puck.vx *= 0.999;
    puck.vy *= 0.999;

    if (puck.x < PUCK_R) {
      puck.x = PUCK_R;
      puck.vx *= -1;
    }
    if (puck.x > LW - PUCK_R) {
      puck.x = LW - PUCK_R;
      puck.vx *= -1;
    }

    if (puck.y < PUCK_R) {
      const inGap = Math.abs(puck.x - LW / 2) < GOAL_HALF;
      if (inGap) {
        if (puck.y < -PUCK_R) {
          handleGoal("p1");
          return;
        }
      } else {
        puck.y = PUCK_R;
        puck.vy *= -1;
      }
    }
    if (puck.y > LH - PUCK_R) {
      const inGap = Math.abs(puck.x - LW / 2) < GOAL_HALF;
      if (inGap) {
        if (puck.y > LH + PUCK_R) {
          handleGoal("p2");
          return;
        }
      } else {
        puck.y = LH - PUCK_R;
        puck.vy *= -1;
      }
    }

    ["p1", "p2"].forEach((k) => {
      const pd = G[k];
      const dx = puck.x - pd.x, dy = puck.y - pd.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const minDist = PADDLE_R + PUCK_R;
      if (dist < minDist && dist > 0.001) {
        const nx = dx / dist, ny = dy / dist;
        puck.x = pd.x + nx * minDist;
        puck.y = pd.y + ny * minDist;
        const dot = puck.vx * nx + puck.vy * ny;
        puck.vx = puck.vx - 2 * dot * nx + pd.vx * 0.6;
        puck.vy = puck.vy - 2 * dot * ny + pd.vy * 0.6;
        const sp = Math.sqrt(puck.vx * puck.vx + puck.vy * puck.vy);
        const maxSp = 8.5;
        if (sp > maxSp) {
          puck.vx = (puck.vx / sp) * maxSp;
          puck.vy = (puck.vy / sp) * maxSp;
        }
        const minSp = 2.2;
        if (sp < minSp && sp > 0.01) {
          puck.vx = (puck.vx / sp) * minSp;
          puck.vy = (puck.vy / sp) * minSp;
        }
      }
    });
  };

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawPaddle(ctx, pd, img) {
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(pd.x, pd.y, PADDLE_R, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.arc(pd.x, pd.y, PADDLE_R - 2, 0, Math.PI * 2);
    ctx.clip();
    if (img && img.complete && img.naturalWidth) {
      ctx.drawImage(img, pd.x - PADDLE_R, pd.y - PADDLE_R, PADDLE_R * 2, PADDLE_R * 2);
    }
    ctx.restore();
    ctx.beginPath();
    ctx.arc(pd.x, pd.y, PADDLE_R, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(251,208,30,0.8)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const G = gRef.current;
    ctx.clearRect(0, 0, LW, LH);

    const grad = ctx.createLinearGradient(0, 0, 0, LH);
    grad.addColorStop(0, "#182352");
    grad.addColorStop(1, "#101833");
    ctx.fillStyle = grad;
    roundRect(ctx, 0, 0, LW, LH, 18);
    ctx.fill();

    ctx.strokeStyle = "rgba(251,208,30,0.55)";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 7]);
    ctx.beginPath();
    ctx.moveTo(8, LH / 2);
    ctx.lineTo(LW - 8, LH / 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(LW / 2, LH / 2, 34, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = "#fbd01e";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(LW / 2 - GOAL_HALF, 3);
    ctx.lineTo(LW / 2 + GOAL_HALF, 3);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(LW / 2 - GOAL_HALF, LH - 3);
    ctx.lineTo(LW / 2 + GOAL_HALF, LH - 3);
    ctx.stroke();

    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 3;
    roundRect(ctx, 1.5, 1.5, LW - 3, LH - 3, 17);
    ctx.stroke();

    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.4)";
    ctx.shadowBlur = 10;
    const pg = ctx.createRadialGradient(G.puck.x - 3, G.puck.y - 3, 1, G.puck.x, G.puck.y, PUCK_R);
    pg.addColorStop(0, "#fff5c2");
    pg.addColorStop(1, "#fbd01e");
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.arc(G.puck.x, G.puck.y, PUCK_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    drawPaddle(ctx, G.p1, img1Ref.current);
    drawPaddle(ctx, G.p2, img2Ref.current);
  }, []);

  const loop = useCallback(() => {
    const G = gRef.current;
    if (!G.running) return;
    step();
    draw();
    rafRef.current = requestAnimationFrame(loop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draw]);

  // idle preview once canvas + images are ready
  useEffect(() => {
    if (screen === "game") {
      resizeCanvas();
      draw();
    }
  }, [screen, draw, resizeCanvas]);

  useEffect(() => stopGame, []); // cleanup on unmount

  /* ---------------- render ---------------- */
  return (
    <div className="ph-root">
      <header className="ph-header">
        {screen === "game" && (
          <button className="ph-back-btn" aria-label="Назад" onClick={goHome}>
            ←
          </button>
        )}
        {scoreVisible && (
          <div className="ph-score-box">
            <span className="ph-name">{names.p1}</span>
            <span className="ph-num">{scores.p1}</span>
            <span>:</span>
            <span className="ph-num">{scores.p2}</span>
            <span className="ph-name">{names.p2}</span>
          </div>
        )}
      </header>

      <main className="ph-main">
        {screen === "home" && (
          <section className={"ph-screen ph-home" + (leaving ? " leaving" : "")}>
            <div className="ph-logos-row">
              <div
                className={"ph-logo-wrap" + (hoverKey === "logo1" ? " hover" : "")}
                onPointerEnter={() => handleEnter("logo1")}
                onPointerLeave={handleLeave}
                onFocus={() => handleEnter("logo1")}
                onBlur={handleLeave}
                tabIndex={0}
              >
                <div className="ph-logo-trigger">
                  <img src={logo1Src} alt="Профком студентів ЛНУ ім. Івана Франка" />
                </div>
              </div>
              <div
                className={"ph-logo-wrap" + (hoverKey === "logo2" ? " hover" : "")}
                onPointerEnter={() => handleEnter("logo2")}
                onPointerLeave={handleLeave}
                onFocus={() => handleEnter("logo2")}
                onBlur={handleLeave}
                onClick={handleLogo2Click}
                tabIndex={0}
              >
                <div className="ph-logo-trigger">
                  <img src={logo2Src} alt="Відділ з цифровізації" />
                </div>
              </div>
            </div>
            <p className="ph-announce">
              Сайт буде доступний з <strong>21.09.2026 20:00</strong>
            </p>
          </section>
        )}

        {hoverKey && (
          <div className={"ph-veil show " + (hoverKey === "logo1" ? "side-right" : "side-left")}>
            <div className="ph-msg-box">
              <h3>Про нас</h3>
              <p>{LOREM[hoverKey][0]}</p>
              <p>{LOREM[hoverKey][1]}</p>
            </div>
          </div>
        )}

        {screen === "game" && (
          <section className="ph-screen ph-game">
            <p className="ph-round-info" style={{ opacity: roundVisible ? 1 : 0 }}>
              {roundText}
            </p>

            <div className={"ph-hockey-wrap" + (drawn ? " drawn" : "")}>
              <canvas
                ref={canvasRef}
                className="ph-hockey-canvas"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={releasePointer}
                onPointerCancel={releasePointer}
              />
              <div className={"ph-result-flash" + (flashShow ? " show" : "")}>{flashText}</div>

              {overlay === "mode" && (
                <div className="ph-card-overlay show">
                  <div className="ph-card">
                    <h2>Секрет знайдено 🎉</h2>
                    <p>Поки чекаємо на запуск — може, зіграємо в аерохокей лого проти лого?</p>
                    <button className="ph-btn gold" onClick={() => startGame("friend")}>
                      Грати з другом
                    </button>
                    <button className="ph-btn" onClick={() => startGame("bot")}>
                      Проти бота
                    </button>
                  </div>
                </div>
              )}

              {overlay === "end" && (
                <div className="ph-card-overlay show">
                  <div className="ph-card">
                    <h2>Гру завершено</h2>
                    <p>{endText}</p>
                    <button className="ph-btn gold" onClick={() => startGame(gRef.current.mode)}>
                      Ще раз
                    </button>
                    <button className="ph-btn secondary" onClick={goHome}>
                      На головну
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
