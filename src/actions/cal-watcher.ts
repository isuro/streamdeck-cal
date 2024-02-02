import streamDeck, { action, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";
import { execSync } from 'child_process';
import iCal, { VEvent } from "node-ical";
import { differenceInMinutes, isThisHour, isToday } from 'date-fns'
import wrap from 'word-wrap'

const logger = streamDeck.logger.createScope("Hello");

let ALL_EVENTS: ReturnType<typeof filterEvents> = []
let lastFetched: number = 0

const filterEvents = (data: iCal.CalendarResponse, myEmail: string) => Object.values(data)
	.filter((e): e is VEvent => e.type === 'VEVENT')
	.filter((e) => e.datetype === 'date-time')
	.filter((e) => isToday(e.start) || (e.recurrences && Object.values(e.recurrences).some((r) => isToday(r.start))))
	.map((e) => isToday(e.start) ? e : Object.values(e.recurrences!).find((r) => isToday(r.start)))
	.filter((e) => {
		if (!e || typeof e.attendee === 'string') { return true }

		// only 1 attendee, as with a big meeting
		if (!Array.isArray(e.attendee)) {
			return e.attendee?.params.PARTSTAT !== 'DECLINED'
		}

		const myAttendee = e.attendee.find((a) => {
			return typeof a !== 'string' && a.params.CN === myEmail
		})

		return !myAttendee || typeof myAttendee === 'string' || (myAttendee.params.PARTSTAT !== 'DECLINED')
	})
	.sort((a, b) => a!.start.getTime() - b!.start.getTime())

@action({ UUID: "com.isaac.cal.next" })
export class NextEvent extends SingletonAction<WatcherSettings> {
	onWillAppear(ev: WillAppearEvent<WatcherSettings>): void | Promise<void> {
		const doAction = async () => {
			if (ALL_EVENTS.length === 0 || Date.now() - lastFetched > 1000 * 60 * 10) {
				ALL_EVENTS.length === 0 && ev.action.setTitle('Fetching\nevents...')

				const {calUrl, myEmail} = await ev.action.getSettings()
				const data = await iCal.fromURL(calUrl)

				ALL_EVENTS = filterEvents(data, myEmail)
				lastFetched = Date.now()
			}

			const nextEvent = ALL_EVENTS.filter((e) => e!.start > new Date())[0]

			// logger.info(JSON.stringify(nextEvent))

			if (!nextEvent) {
				setTimeout(doAction, 1000 * 60)
				ev.action.setTitle('No\nevents\nleft');
				return
			}

			const minuteDifference = differenceInMinutes(nextEvent.start, new Date());
			const timeRepresentation = minuteDifference < 60 ? `${minuteDifference}m` : `${Math.floor(minuteDifference / 60)}h ${minuteDifference % 60}m`;

			let title = wrap(nextEvent.summary.replaceAll('/', '/​'), { width: 8 })
			// if more than 4 lines, replace lines 4+ with ellipsis
			if (title.split('\n').length > 4) {
				title = title.split('\n').slice(0, 3).join('\n') + '\n…';
			} else if (title.split('\n').length < 4) {
				title = title + '\n'
			}

			ev.action.setTitle(`${title}\nin ${timeRepresentation}`);

			setTimeout(doAction, 1000 * 60)
		}

		doAction()

		/*
		const { excludeCalendars } = ev.payload.settings;
		// ev.action.setTitle(process.cwd().slice(-9));
		// throw new Error(process.cwd());
		const command = [
			`./icalBuddy`,
			'--debug',
			'--excludeAllDayEvents',
			'--noCalendarNames',
			'--includeOnlyEventsFromNowOn',
			'--includeEventProps title,datetime',
			'--bullet ""',
			'--propertySeparators "|;;;|"',
			'--timeFormat "%H:%M"',
			...(excludeCalendars ? ['--excludeCals ' + excludeCalendars] : []),
			'eventsFrom:"today" to:"today"'
		].join(' ');
		const events = execSync(command)
			.toString()
			.split('\n')
			.map((e) => {
				const [title, datetime] = e.split(';;;')
				const [date, timestr] = datetime.split('at')
				const [startTimestr, endTimestr] = timestr.split(' - ')
				const startTime = new Date(`${date} ${startTimestr}`)
				const endTime = new Date(`${date} ${endTimestr ?? startTimestr}`)
				return { title, startTime, endTime }
			})
			.filter((e) => e.title !== '🏠 Personal Commitment');
		return ev.action.setTitle(`${events[0].title.slice(0, 7)}…\n${events[0].startTime.toTimeString().slice(0, 5)}`);
		*/
	}
}

@action({ UUID: "com.isaac.cal.current" })
export class CurrentEvent extends SingletonAction<WatcherSettings> {
	/**
	 * The {@link SingletonAction.onWillAppear} event is useful for setting the visual representation of an action when it become visible. This could be due to the Stream Deck first
	 * starting up, or the user navigating between pages / folders etc.. There is also an inverse of this event in the form of {@link streamDeck.client.onWillDisappear}. In this example,
	 * we're setting the title to the "count" that is incremented in {@link CalWatcher.onKeyDown}.
	 */
	onWillAppear(ev: WillAppearEvent<WatcherSettings>): void | Promise<void> {
		const doAction = () => {
			// wait 10s for events to be fetched
			if (ALL_EVENTS.length === 0) {
				setTimeout(doAction, 1000 * 5)
				ev.action.setTitle('Wait\nfor it');
				return
			}

			const currentEvent = ALL_EVENTS.filter((e) => e!.start < new Date() && e!.end > new Date())[0]

			logger.info(JSON.stringify(currentEvent))

			if (!currentEvent) {
				setTimeout(doAction, 1000 * 60)
				ev.action.setImage()
				ev.action.setTitle('Nothing\nnow');
				return
			}

			const minuteDifference = differenceInMinutes(currentEvent.end, new Date());
			const timeRepresentation = minuteDifference < 60 ? `${minuteDifference}m` : `${Math.floor(minuteDifference / 60)}h ${minuteDifference % 60}m`;

			let title = wrap(currentEvent.summary.replaceAll('/', '/​'), { width: 8 })
			// if more than 4 lines, replace lines 4+ with ellipsis
			if (title.split('\n').length > 4) {
				title = title.split('\n').slice(0, 3).join('\n') + '\n…';
			} else if (title.split('\n').length < 4) {
				title = title + '\n'
			}

			if (minuteDifference <= 1) {
				ev.action.setImage('imgs/Reddit.jpg')
			} else if (minuteDifference <= 5) {
				ev.action.setImage('imgs/Pure Yellow Orange.jpg')
			} else if (minuteDifference <= 10) {
				ev.action.setImage('imgs/Pure Blue.jpg')
			} else {
				ev.action.setImage('imgs/Pure Blue Violet.jpg')
			}

			ev.action.setTitle(`${timeRepresentation}\nleft`);
			setTimeout(doAction, 1000 * 60)
		}

		doAction()
	}
}

/**
 * Settings for {@link CalWatcher}.
 */
type WatcherSettings = {
	calUrl: string;
	myEmail: string;
};
