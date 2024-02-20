import streamDeck, { action, KeyDownEvent, SingletonAction, TouchTapEvent, WillAppearEvent, WillDisappearEvent } from "@elgato/streamdeck";
import wrap from 'word-wrap'
import { execSync } from "node:child_process";

const logger = streamDeck.logger.createScope("Hello");

@action({ UUID: "com.isaac.cal.next" })
export class NextEvent extends SingletonAction<WatcherSettings> {
    intervalId: NodeJS.Timeout | null = null

    async doAction(ev: WillAppearEvent<WatcherSettings>): Promise<void> {
        const command = 'shortcuts run next-event';
        const [nextEvent, minutesString] = execSync(command).toString().split(';;');

        if (!nextEvent) {
            ev.action.setTitle('No\nevents\nleft');
            return
        }

        const minutesRemaining = Number.parseInt(minutesString)
        const timeRepresentation = minutesRemaining < 60 ? `${minutesRemaining}m` : `${Math.floor(minutesRemaining / 60)}h ${minutesRemaining % 60}m`;

        let title = wrap(nextEvent.replaceAll('/', '/​'), { width: 8 })
        // if more than 4 lines, replace lines 4+ with ellipsis
        if (title.split('\n').length > 4) {
            title = title.split('\n').slice(0, 3).join('\n') + '\n…';
        } else if (title.split('\n').length < 4) {
            title = title + '\n'
        }

        ev.action.setTitle(`${title}\nin ${timeRepresentation}`);
    }

    onWillAppear(ev: WillAppearEvent<WatcherSettings>): void | Promise<void> {
        this.doAction(ev)
        this.intervalId = setInterval(this.doAction, 1000 * 60, ev)
    }

    onWillDisappear(ev: WillDisappearEvent<WatcherSettings>): void | Promise<void> {
        clearInterval(this.intervalId!)
    }
}

@action({ UUID: "com.isaac.cal.current" })
export class CurrentEvent extends SingletonAction<WatcherSettings> {
    intervalId: NodeJS.Timeout | null = null

    async doAction(ev: WillAppearEvent<WatcherSettings>) {

        // run shell command to get currentEvent
        const minutesRemaining = Number.parseInt(execSync('shortcuts run current-event').toString());

        if (!minutesRemaining) {
            ev.action.setImage()
            ev.action.setTitle('Nothing\nnow');
            return
        }

        const timeRepresentation = minutesRemaining < 60 ? `${minutesRemaining}m` : `${Math.floor(minutesRemaining / 60)}h ${minutesRemaining % 60}m`;

        if (minutesRemaining <= 1) {
            ev.action.setImage('imgs/Reddit.jpg')
        } else if (minutesRemaining <= 5) {
            ev.action.setImage('imgs/Pure Yellow Orange.jpg')
        } else if (minutesRemaining <= 10) {
            ev.action.setImage('imgs/Pure Blue.jpg')
        } else {
            ev.action.setImage('imgs/Pure Blue Violet.jpg')
        }

        ev.action.setTitle(`${timeRepresentation}\nleft`);
    }

    onWillAppear(ev: WillAppearEvent<WatcherSettings>): void | Promise<void> {
        this.doAction(ev)
        this.intervalId = setInterval(this.doAction, 1000 * 60, ev)
    }

    onWillDisappear(ev: WillDisappearEvent<WatcherSettings>): void | Promise<void> {
        clearInterval(this.intervalId!)
    }
}

/**
 * Settings for {@link NextEvent}.
 */
type WatcherSettings = {
};
