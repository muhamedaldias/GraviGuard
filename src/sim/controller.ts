// GraviGuard controller state machine (Section 4.9).
// States: IDLE -> ARMED -> INJECTING -> HOLD -> RECOVERY -> REFILL -> IDLE,
// plus MANUAL and FAULT_SAFE. All thresholds are configurable.

import { ControllerParams, CtrlState, CtrlStateName } from './types';
import { clamp } from './cavitation';

export interface ControllerContext {
  t: number;
  R_est: number;
  R_slope: number;
  R_src_est: number;
  tankH: number;
  tankReserveH: number;
  tankFullH: number;
  sensorsHealthy: boolean;
  valveFault: boolean;
  mode: 'OFF' | 'ON' | 'MANUAL';
  manualValve: number;
  theta: number;
  thetaTarget: number;
  strokeTime: number;
  n: number;
}

export function createController(): CtrlState {
  return {
    name: 'IDLE',
    timeInState: 0,
    timer: 0,
    cycles: 0,
    cycleTimes: [],
    integral: 0,
    thetaCmd: 0,
    alarm: null,
    transitions: [],
  };
}

function transition(c: CtrlState, to: CtrlStateName, t: number): void {
  c.transitions.push({ t, from: c.name, to });
  if (c.transitions.length > 400) c.transitions.splice(0, c.transitions.length - 400);
  c.name = to;
  c.timeInState = 0;
  c.timer = 0;
}

function cyclesInWindow(c: CtrlState, t: number): number {
  while (c.cycleTimes.length > 0 && c.cycleTimes[0] < t - 3600) c.cycleTimes.shift();
  return c.cycleTimes.length;
}

export function updateController(
  c: CtrlState,
  ctx: ControllerContext,
  p: ControllerParams,
  dt: number,
): void {
  c.timeInState += dt;
  c.timer += dt;
  const T_pred = p.T_pred_extra + ctx.strokeTime;
  const canLeave = c.timeInState >= p.minDwell;
  const fault = !ctx.sensorsHealthy || ctx.valveFault;
  // Tank reserve interlock: block injection and fail-safe before the level
  // drops below the reserve line (Section 4.4 / scenario S8).
  const tankEmpty = ctx.tankH <= ctx.tankReserveH * 1.02;

  // Mode handling ---------------------------------------------------------
  if (ctx.mode === 'OFF') {
    c.thetaCmd = 0;
    c.integral = 0;
    if (c.name !== 'IDLE') transition(c, 'IDLE', ctx.t);
    return;
  }
  if (ctx.mode === 'MANUAL') {
    c.thetaCmd = clamp(ctx.manualValve, 0, 1);
    c.integral = 0;
    if (c.name !== 'MANUAL') transition(c, 'MANUAL', ctx.t);
    return;
  }

  // Fault latching --------------------------------------------------------
  if ((fault || tankEmpty) && c.name !== 'FAULT_SAFE') {
    c.alarm = tankEmpty
      ? 'Tank at reserve — injection blocked, VFD fallback'
      : ctx.valveFault
        ? 'Valve fault detected — GraviGuard unavailable'
        : 'Sensor fault detected — fail-safe active';
    transition(c, 'FAULT_SAFE', ctx.t);
    return;
  }

  switch (c.name) {
    case 'IDLE': {
      c.thetaCmd = 0;
      if (ctx.R_est < p.R_arm || ctx.R_est + ctx.R_slope * T_pred < p.R_pred) {
        transition(c, 'ARMED', ctx.t);
      }
      break;
    }
    case 'ARMED': {
      // Source recovered before injection was needed.
      if (ctx.R_est > p.R_arm + 0.2 && canLeave) {
        transition(c, 'IDLE', ctx.t);
        break;
      }
      if (ctx.R_est < p.R_inject && c.timer >= p.injectDelay) {
        if (cyclesInWindow(c, ctx.t) >= p.maxCyclesPerHour) {
          c.alarm = 'Injection cycle limit exceeded (3/hour)';
          break;
        }
        c.cycles += 1;
        c.cycleTimes.push(ctx.t);
        c.integral = 0;
        transition(c, 'INJECTING', ctx.t);
      }
      break;
    }
    case 'INJECTING': {
      const err = p.R_target - ctx.R_est;
      // Feedforward from the hydraulic solution + a very small integral trim.
      // The plant gain (dR/dtheta) is high, so aggressive feedback oscillates.
      if (Math.abs(err) > 0.1) {
        c.integral = clamp(c.integral + err * dt, -0.05, 0.05);
      }
      let cmd = ctx.thetaTarget + c.integral * p.Ki * 8;
      // Safety brake if the estimate is well above target.
      if (ctx.R_est > p.R_target + 0.5) cmd = Math.min(cmd, ctx.theta);
      c.thetaCmd = clamp(cmd, 0, 1);

      if (ctx.R_est >= p.R_target - p.holdBand) {
        if (c.timer >= p.holdTime) transition(c, 'HOLD', ctx.t);
      } else {
        c.timer = 0;
      }
      break;
    }
    case 'HOLD': {
      // Valve held at its current position. Hysteresis + minimum dwell
      // prevent chatter around the target band.
      if (canLeave) {
        if (ctx.R_src_est > p.R_recover && c.timer >= p.recoverTime) {
          transition(c, 'RECOVERY', ctx.t);
        } else if (ctx.R_est < p.R_target - 0.15) {
          c.integral = 0;
          transition(c, 'INJECTING', ctx.t);
        } else if (ctx.R_est > p.R_target + 0.6 && c.timer >= 10) {
          // Over-injection: trim back towards the target.
          c.integral = 0;
          transition(c, 'INJECTING', ctx.t);
        }
      }
      break;
    }
    case 'RECOVERY': {
      // Close at a rate respecting the water-hammer limit (2x stroke time).
      const rate = 1 / Math.max(ctx.strokeTime * 2, 1);
      c.thetaCmd = Math.max(0, c.thetaCmd - rate * dt);
      if (c.thetaCmd <= 0.005) transition(c, 'REFILL', ctx.t);
      else if (ctx.R_est < p.R_inject) transition(c, 'INJECTING', ctx.t);
      break;
    }
    case 'REFILL': {
      c.thetaCmd = 0;
      if (ctx.tankH >= 0.95 * ctx.tankFullH && ctx.R_est > p.R_arm) {
        transition(c, 'IDLE', ctx.t);
      }
      break;
    }
    case 'MANUAL': {
      // Reached only if mode changed while in MANUAL (handled above).
      break;
    }
    case 'FAULT_SAFE': {
      c.thetaCmd = 0;
      if (!fault && canLeave && ctx.tankH > ctx.tankReserveH) {
        c.alarm = null;
        transition(c, 'IDLE', ctx.t);
      }
      break;
    }
  }
}
