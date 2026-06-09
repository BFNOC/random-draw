import { sampleNames } from './threeLotteryNames'

const ORBIT_LABEL_COUNT = 36
const INTAKE_LABEL_COUNT = 36
const DRAWING_LABEL_COUNT = 48

export const createThreeLotteryPhaseController = (props, phase, deck, objects, runtime) => {
  const timers = createPhaseTimers()
  const controller = createPhaseActions(props, phase, deck, objects, runtime, timers)
  return controller
}

const createPhaseTimers = () => {
  let phaseTimer = 0
  let shuffleTimer = 0

  const clearPhaseTimer = () => {
    if (!phaseTimer) return
    window.clearTimeout(phaseTimer)
    phaseTimer = 0
  }

  const clearShuffleTimer = () => {
    if (!shuffleTimer) return
    window.clearInterval(shuffleTimer)
    shuffleTimer = 0
  }

  return {
    clearPhaseTimer,
    clearShuffleTimer,
    dispose() {
      clearPhaseTimer()
      clearShuffleTimer()
    },
    setPhaseTimer(timer) {
      phaseTimer = timer
    },
    setShuffleTimer(timer) {
      shuffleTimer = timer
    }
  }
}

const createPhaseActions = (props, phase, deck, objects, runtime, timers) => {
  const withCleanTimers = (nextPhase) => {
    timers.clearPhaseTimer()
    timers.clearShuffleTimer()
    phase.value = nextPhase
  }

  const controller = {
    dispose() {
      timers.dispose()
    },
    enterEmpty() {
      withCleanTimers('empty')
      deck.rebuild([], 'empty')
    },
    enterIntake() {
      if (props.poolNames.length === 0) {
        controller.enterEmpty()
        return
      }
      withCleanTimers('intake')
      deck.rebuild(sampleNames(props.poolNames, INTAKE_LABEL_COUNT, true), 'intake')
      timers.setPhaseTimer(window.setTimeout(controller.enterOrbit, 2400))
    },
    enterOrbit() {
      if (props.poolNames.length === 0) {
        controller.enterEmpty()
        return
      }
      timers.clearPhaseTimer()
      phase.value = 'orbit'
      refreshOrbitDeck(props.poolNames, deck)
      timers.clearShuffleTimer()
      timers.setShuffleTimer(window.setInterval(() => {
        if (phase.value !== 'orbit' || props.poolNames.length === 0) return
        deck.refreshBack(sampleNames(props.poolNames, ORBIT_LABEL_COUNT, true), 'orbit')
      }, 950))
    },
    enterClearing() {
      withCleanTimers('clearing')
      timers.setPhaseTimer(window.setTimeout(controller.enterDrawing, 720))
    },
    enterDrawing() {
      if (props.poolNames.length === 0) return
      withCleanTimers('drawing')
      deck.rebuild(sampleNames(props.poolNames, DRAWING_LABEL_COUNT, true), 'drawing')
      timers.setShuffleTimer(window.setInterval(() => {
        if (phase.value === 'drawing') deck.rebuild(sampleNames(props.poolNames, DRAWING_LABEL_COUNT, true), 'drawing')
      }, 260))
    },
    enterFusion() {
      withCleanTimers('fusion')
      deck.rebuild(sampleNames(getFusionNames(props), ORBIT_LABEL_COUNT, true), 'fusion')
    },
    enterBurst() {
      withCleanTimers('burst')
      runtime.burstStartTime = runtime.clock?.elapsedTime ?? 0
      objects.resetBurstParticles()
      deck.rebuild(sampleNames(getBurstNames(props), ORBIT_LABEL_COUNT, true), 'burst')
    },
    enterResult() {
      withCleanTimers('result')
      deck.rebuild(sampleNames(props.names, Math.min(ORBIT_LABEL_COUNT, Math.max(props.names.length, 1)), false), 'result')
    },
    syncFromProps(initial = false) {
      syncPhaseFromProps(props, initial, controller)
    }
  }

  return controller
}

const refreshOrbitDeck = (poolNames, deck) => {
  const orbitNames = sampleNames(poolNames, ORBIT_LABEL_COUNT, true)
  if (deck.cards.length === orbitNames.length) deck.refresh(orbitNames, 'orbit')
  else deck.rebuild(orbitNames, 'orbit')
}

const syncPhaseFromProps = (props, initial, controller) => {
  if (props.isBursting) return controller.enterBurst()
  if (props.isRevealing) return controller.enterFusion()
  if (props.isDrawing) return initial || props.names.length === 0 ? controller.enterDrawing() : controller.enterClearing()
  if (props.names.length > 0) return controller.enterResult()
  if (props.poolNames.length > 0) return initial ? controller.enterOrbit() : controller.enterIntake()
  return controller.enterEmpty()
}

const getFusionNames = (props) => props.poolNames.length > 0 ? props.poolNames : props.names

const getBurstNames = (props) => props.names.length > 0 ? props.names : props.poolNames
