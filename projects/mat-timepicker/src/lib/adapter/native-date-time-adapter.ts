import { Inject, Injectable, Optional, inject } from '@angular/core';

import { MAT_TIME_LOCALE, TimeAdapter } from './time-adapter';
import { MatTimePeriodType } from '../time-period';

/**
 * Matches strings that have the form of a valid RFC 3339 string
 * (https://tools.ietf.org/html/rfc3339). Note that the string may not actually be a valid date
 * because the regex will match strings an with out of bounds month, date, etc.
 */
const ISO_8601_REGEX =
  /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|(?:(?:\+|-)\d{2}:\d{2}))?)?$/;

/** Adapts the native JS Date for components that work with time. */
@Injectable()
export class NativeDateTimeAdapter extends TimeAdapter<Date> {
  private readonly _matTimeLocale = inject(MAT_TIME_LOCALE, { optional: true });

  constructor(@Optional() @Inject(MAT_TIME_LOCALE) matTimeLocale: string) {
    super();
    if (matTimeLocale !== undefined) {
      this._matTimeLocale = matTimeLocale;
    }
    super.setLocale(this._matTimeLocale);
  }

  now(): Date {
    return new Date();
  }

  parse(value: any, parseFormat?: any): Date | null {
    // We have no way using the native JS Date to set the parse format or locale, so we ignore these
    // parameters.
    if (typeof value == 'number') {
      return new Date(value);
    }

    const { hour, minute, meridiem } = this.parseTime(value);
    // hour should be in 24h format
    // so, if meridiem is 'pm' and hour is less than 12, add 12 to hour
    const correctedHour = meridiem === 'pm' && hour < 12 ? hour + 12 : hour;
    const date = new Date();
    date.setHours(correctedHour);
    date.setMinutes(minute);

    return value ? new Date(date) : null;
  }

  parseTime(value: string): {
    hour: number;
    minute: number;
    meridiem?: 'am' | 'pm';
  } {
    const time = value.replace(/(\sam|\spm|\sAM|\sPM|am|pm|AM|PM)/g, '');
    const meridiem = value.replace(time, '').trim().toLowerCase() as
      | 'am'
      | 'pm';
    const [hour, minute] = time.split(':');

    return { hour: Number(hour), minute: Number(minute), meridiem };
  }

  getHour(date: Date): number {
    return date.getHours();
  }

  getMinute(date: Date): number {
    return date.getMinutes();
  }

  updateHour(date: Date, hour: number): Date {
    const copy = new Date(date.getTime());
    copy.setHours(hour);

    return copy;
  }

  updateMinute(date: Date, minute: number): Date {
    const copy = new Date(date.getTime());
    copy.setMinutes(minute);

    return copy;
  }

  getPeriod(date: Date): MatTimePeriodType {
    return date.getHours() < 12 ? 'am' : 'pm';
  }

  format(date: Date, displayFormat: Object): string {
    if (!this.isValid(date)) {
      throw Error('NativeDateTimeAdapter: Cannot format invalid date.');
    }

    const dtf = new Intl.DateTimeFormat(this.locale, {
      ...displayFormat,
      timeZone: 'utc',
    });

    return this._format(dtf, date);
  }

  /**
   * Returns the given value if given a valid Date or null. Deserializes valid ISO 8601 strings
   * (https://www.ietf.org/rfc/rfc3339.txt) into valid Dates and empty string into null. Returns an
   * invalid date for all other values.
   */
  override deserialize(value: any): Date | null {
    if (typeof value === 'string') {
      if (!value) {
        return null;
      }
      // The `Date` constructor accepts formats other than ISO 8601, so we need to make sure the
      // string is the right format first.
      if (ISO_8601_REGEX.test(value)) {
        const date = new Date(value);
        if (this.isValid(date)) {
          return date;
        }
      }
    }
    return super.deserialize(value);
  }

  isTimeInstance(obj: any): boolean {
    return obj instanceof Date;
  }

  isValid(date: Date): boolean {
    return !isNaN(date.getTime());
  }

  invalid(): Date {
    return new Date(NaN);
  }

  compareTime(first: Date, second: Date): number {
    return (
      first.getHours() - second.getHours() ||
      first.getMinutes() - second.getMinutes()
    );
  }

  /**
   * When converting Date object to string, javascript built-in functions may return wrong
   * results because it applies its internal DST rules. The DST rules around the world change
   * very frequently, and the current valid rule is not always valid in previous years though.
   * We work around this problem building a new Date object which has its internal UTC
   * representation with the local date and time.
   * @param dtf Intl.DateTimeFormat object, containing the desired string format. It must have
   *    timeZone set to 'utc' to work fine.
   * @param date Date from which we want to get the string representation according to dtf
   * @returns A Date object with its UTC representation based on the passed in date info
   */
  private _format(dtf: Intl.DateTimeFormat, date: Date) {
    // Passing the year to the constructor causes year numbers <100 to be converted to 19xx.
    // To work around this we use `setUTCFullYear` and `setUTCHours` instead.
    const d = new Date();
    d.setUTCFullYear(date.getFullYear(), date.getMonth(), date.getDate());
    d.setUTCHours(
      date.getHours(),
      date.getMinutes(),
      date.getSeconds(),
      date.getMilliseconds(),
    );
    return dtf.format(d);
  }
}
