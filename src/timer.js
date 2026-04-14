// src/timer.js — requestAnimationFrame timer (brak driftu)

import { emitter } from './eventEmitter.js';

export function createTimer(seconds, onTick, onEnd) {
  let timeLeft = seconds;
  let rafId = null;
  let lastTimestamp = null;
  let accumulator = 0;
  let running = false;
  let paused = false;
  let pauseTimer = null; // setTimeout dla tymczasowej pauzy

  function tick(timestamp) {
    if (!running) return;

    if (lastTimestamp === null) {
      lastTimestamp = timestamp;
    }

    if (!paused) {
      accumulator += timestamp - lastTimestamp;

      while (accumulator >= 1000) {
        accumulator -= 1000;
        timeLeft = Math.max(0, timeLeft - 1);
        onTick(timeLeft);

        if (timeLeft <= 0) {
          running = false;
          onEnd();
          return;
        }
      }
    }

    lastTimestamp = timestamp;
    rafId = requestAnimationFrame(tick);
  }

  function start() {
    if (running) return;
    running = true;
    paused = false;
    lastTimestamp = null;
    accumulator = 0;
    rafId = requestAnimationFrame(tick);
  }

  function pause() {
    paused = true;
  }

  function resume() {
    if (!running) return;
    paused = false;
    lastTimestamp = null; // reset, aby uniknąć skoku
  }

  function stop() {
    running = false;
    paused = false;
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (pauseTimer) {
      clearTimeout(pauseTimer);
      pauseTimer = null;
    }
  }

  // Tymczasowa pauza (Elipsa)
  function pauseFor(durationSeconds) {
    if (!running) return;
    pause();
    if (pauseTimer) clearTimeout(pauseTimer);
    pauseTimer = setTimeout(() => {
      pauseTimer = null;
      if (running) resume();
    }, durationSeconds * 1000);
  }

  function getTimeLeft() {
    return timeLeft;
  }

  function isRunning() {
    return running;
  }

  // Nasłuchuj na zdarzenie Elipsy
  const elipsaHandler = ({ duration }) => pauseFor(duration);
  emitter.on('timerPause', elipsaHandler);

  // Cleanup przy zatrzymaniu
  const originalStop = stop;
  function stopWithCleanup() {
    emitter.off('timerPause', elipsaHandler);
    originalStop();
  }

  return { start, pause, resume, stop: stopWithCleanup, pauseFor, getTimeLeft, isRunning };
}
