"use client";

import { useCallback, useEffect, useState } from "react";
import { type ChartPhase, type ChartStatus } from "./chart-phase";

export interface UseChartPhaseOrchestratorOptions {
  chartStatus: ChartStatus;
  targetData: Record<string, unknown>[];
  skeletonData: Record<string, unknown>[];
  animationDuration: number;
  yDomainTweenDuration: number;
  revealSignature?: string;
  skipEnterReveal?: boolean;
}

interface PhaseState {
  chartPhase: ChartPhase;
  revealEpoch: number;
  concealEpoch: number;
  chartStatus: ChartStatus;
  animationDuration: number;
  revealSignature: string;
  skipEnterReveal: boolean;
}

function enterPhase(
  state: PhaseState,
  chartPhase: ChartPhase,
  animationDuration: number
): PhaseState {
  return {
    ...state,
    chartPhase:
      chartPhase === "revealing" && animationDuration <= 0 ? "ready" : chartPhase,
    revealEpoch: state.revealEpoch + (chartPhase === "revealing" ? 1 : 0),
    concealEpoch: state.concealEpoch + (chartPhase === "exitingReady" ? 1 : 0),
  };
}

export function useChartPhaseOrchestrator({
  chartStatus,
  targetData,
  skeletonData,
  animationDuration,
  yDomainTweenDuration,
  revealSignature = "",
  skipEnterReveal = false,
}: UseChartPhaseOrchestratorOptions) {
  const [state, setState] = useState<PhaseState>(() => {
    const initial: PhaseState = {
      chartPhase: chartStatus === "loading" ? "loading" : "ready",
      revealEpoch: 0,
      concealEpoch: 0,
      chartStatus,
      animationDuration,
      revealSignature,
      skipEnterReveal,
    };
    return chartStatus === "ready" && !skipEnterReveal
      ? enterPhase(initial, "revealing", animationDuration)
      : initial;
  });

  if (
    state.chartStatus !== chartStatus ||
    state.animationDuration !== animationDuration ||
    state.revealSignature !== revealSignature ||
    state.skipEnterReveal !== skipEnterReveal
  ) {
    let next = {
      ...state,
      chartStatus,
      animationDuration,
      revealSignature,
      skipEnterReveal,
    };
    if (state.chartStatus !== chartStatus) {
      const phase =
        chartStatus === "ready"
          ? animationDuration > 0
            ? "exiting"
            : yDomainTweenDuration > 0
              ? "gridTweenReady"
              : "revealing"
          : animationDuration > 0
            ? "exitingReady"
            : yDomainTweenDuration > 0
              ? "gridTweenLoading"
              : "loading";
      next = enterPhase(next, phase, animationDuration);
    } else if (
      chartStatus === "ready" &&
      ((!skipEnterReveal && state.chartPhase === "ready") ||
        (state.chartPhase === "revealing" && state.animationDuration !== animationDuration))
    ) {
      next = enterPhase(next, "revealing", animationDuration);
    }
    setState(next);
  }

  const notifyLoadingPulseComplete = useCallback(() => {
    setState((current) => current.chartPhase === "exiting"
      ? { ...current, chartPhase: "gridTweenReady" }
      : current);
  }, []);

  const notifyRevealConcealComplete = useCallback(() => {
    setState((current) => current.chartPhase === "exitingReady"
      ? { ...current, chartPhase: "gridTweenLoading" }
      : current);
  }, []);

  const notifyYDomainTweenComplete = useCallback(() => {
    setState((current) => {
      if (current.chartPhase === "gridTweenLoading") {
        return { ...current, chartPhase: "loading" };
      }
      if (current.chartPhase === "gridTweenReady") {
        return enterPhase(current, "revealing", current.animationDuration);
      }
      return current;
    });
  }, []);

  const { chartPhase, revealEpoch, concealEpoch } = state;

  useEffect(() => {
    if (chartPhase !== "revealing") {
      return;
    }
    const timer = window.setTimeout(() => {
      setState((current) => current.chartPhase === "revealing"
        ? { ...current, chartPhase: "ready" }
        : current);
    }, animationDuration);
    return () => window.clearTimeout(timer);
  }, [animationDuration, chartPhase, revealEpoch]);

  return {
    chartPhase,
    plotData:
      chartPhase === "loading" || chartPhase === "exiting"
        ? skeletonData
        : targetData,
    revealEpoch,
    concealEpoch,
    isLoaded: chartPhase === "ready",
    notifyLoadingPulseComplete,
    notifyRevealConcealComplete,
    notifyYDomainTweenComplete,
  };
}
