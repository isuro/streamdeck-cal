import streamDeck, {
  action,
  SingletonAction,
  WillAppearEvent,
  WillDisappearEvent,
} from '@elgato/streamdeck';
import wrap from 'word-wrap';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const logger = streamDeck.logger.createScope('Hello');

type ActionEvent = WillAppearEvent<WatcherSettings>;

const commonIcalPalPaths = ['/opt/homebrew/bin/icalPal', '/usr/local/bin/icalPal'];
let icalPalPath: string | null = null;

interface CalEvent {
  title: string;
  calendar: string;
  duration: number;
  sctime: string; // human readable start time
  ectime: string; // human readable end time
  all_day: number; // 1 or 0
  invitation_status: number; // 0 seems to be invited?
  status: number; // 0 seems to be confirmed? nope.
  availability: number; // maybe 1 means it's been rejected???
}

const eventFilter = (e: CalEvent) => {
  return (
    e.all_day === 0 &&
    e.availability === 0 &&
    e.title !== '🏠 Personal Commitment' &&
    e.duration < 86400
  );
};

const resolveIcalPalPath = (): string => {
  if (icalPalPath) {
    return icalPalPath;
  }

  try {
    const shellPath = execFileSync('/bin/zsh', ['-lc', 'command -v icalPal'], {
      encoding: 'utf8',
    }).trim();

    if (shellPath && existsSync(shellPath)) {
      icalPalPath = shellPath;
      return icalPalPath;
    }
  } catch {
    logger.debug('Could not resolve icalPal from shell PATH');
  }

  const fallbackPath = commonIcalPalPaths.find(existsSync);
  if (fallbackPath) {
    icalPalPath = fallbackPath;
    return icalPalPath;
  }

  throw new Error('Could not find icalPal. Install it with Homebrew and make sure it is on PATH.');
};

const runIcalPalJson = (args: string[]): CalEvent[] => {
  return JSON.parse(execFileSync(resolveIcalPalPath(), args, { encoding: 'utf8' })) as CalEvent[];
};

const doAndQueueAction = (
  actionFn: (ev: ActionEvent) => Promise<void>,
  ev: ActionEvent,
  setIntervalId: (interval: NodeJS.Timeout) => void
) => {
  actionFn(ev);
  // update at the start of the next minute, then every minute after that
  const now = new Date();
  const millisecondsIntoMinute = now.getSeconds() * 1000 + now.getMilliseconds();
  const delay = 60 * 1000 - millisecondsIntoMinute + 50; // slight offset to ensure we're in the next minute
  setTimeout(() => {
    setIntervalId(setInterval(actionFn, 1000 * 60, ev));
  }, delay);
};

@action({ UUID: 'com.isaac.cal.next' })
export class NextEvent extends SingletonAction<WatcherSettings> {
  intervalId: NodeJS.Timeout | null = null;

  async doAction(ev: ActionEvent): Promise<void> {
    const events = runIcalPalJson(['eventsToday', '--ea', '-n', '-o', 'json']).filter(
      (e: CalEvent) => eventFilter(e) && new Date(e.sctime) > new Date()
    );

    const nextEvent = events[0];
    if (!nextEvent) {
      ev.action.setTitle('No\nevents\nleft');
      return;
    }

    ev.action.setTitle(nextEvent.title);

    // compute minutes until next event
    ev.action.setTitle(nextEvent.sctime.toString());
    const now = new Date();
    const startDate = new Date(nextEvent.sctime);
    const minutesRemaining = Math.ceil((startDate.getTime() - now.getTime()) / (1000 * 60));
    const timeRepresentation =
      minutesRemaining < 60
        ? `${minutesRemaining}m`
        : `${Math.floor(minutesRemaining / 60)}h ${minutesRemaining % 60}m`;

    let title = wrap(nextEvent.title.replaceAll('/', '/​'), { width: 8 });
    // if more than 4 lines, replace lines 4+ with ellipsis
    if (title.split('\n').length > 4) {
      title = title.split('\n').slice(0, 3).join('\n') + '\n…';
    } else if (title.split('\n').length < 4) {
      title = title + '\n';
    }

    ev.action.setTitle(`${title}\nin ${timeRepresentation}`);
  }

  onWillAppear(ev: WillAppearEvent<WatcherSettings>): void | Promise<void> {
    doAndQueueAction(this.doAction, ev, (interval) => {
      this.intervalId = interval;
    });
  }

  onWillDisappear(ev: WillDisappearEvent<WatcherSettings>): void | Promise<void> {
    clearInterval(this.intervalId!);
  }
}

@action({ UUID: 'com.isaac.cal.current' })
export class CurrentEvent extends SingletonAction<WatcherSettings> {
  intervalId: NodeJS.Timeout | null = null;

  async doAction(ev: ActionEvent) {
    // run shell command to get currentEvent
    const currentEvents = runIcalPalJson(['eventsNow', '--ea', '-o', 'json']).filter(eventFilter);
    const currentEvent = currentEvents[0];

    if (!currentEvent) {
      ev.action.setImage();
      ev.action.setTitle('Nothing\nnow');
      return;
    }

    const minutesRemaining = Math.ceil(
      (new Date(currentEvent.ectime).getTime() - new Date().getTime()) / (1000 * 60)
    );

    const timeRepresentation =
      minutesRemaining < 60
        ? `${minutesRemaining}m`
        : `${Math.floor(minutesRemaining / 60)}h ${minutesRemaining % 60}m`;

    if (minutesRemaining <= 1) {
      ev.action.setImage('imgs/Reddit.jpg');
    } else if (minutesRemaining <= 5) {
      ev.action.setImage('imgs/Pure Yellow Orange.jpg');
    } else if (minutesRemaining <= 10) {
      ev.action.setImage('imgs/Pure Blue.jpg');
    } else {
      ev.action.setImage('imgs/Pure Blue Violet.jpg');
    }

    ev.action.setTitle(`${timeRepresentation}\nleft`);
  }

  onWillAppear(ev: WillAppearEvent<WatcherSettings>): void | Promise<void> {
    doAndQueueAction(this.doAction, ev, (interval) => {
      this.intervalId = interval;
    });
  }

  onWillDisappear(ev: WillDisappearEvent<WatcherSettings>): void | Promise<void> {
    clearInterval(this.intervalId!);
  }
}

/**
 * Settings for {@link NextEvent}.
 */
type WatcherSettings = {};
