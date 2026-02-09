import { dayjs } from "@/uni_modules/iRainna-dayjs/js_sdk/dayjs.min.js";

export const DAY = 1000 * 60 * 60 * 24;
export const compareMonth = (date1, date2) => {
  if (dayjs(date1).year() == dayjs(date2).year()) {
    return dayjs(date1).month() == dayjs(date2).month()
      ? 0
      : dayjs(date1).month() > dayjs(date2).month()
      ? 1
      : -1;
  }

  return dayjs(date1).year() > dayjs(date2).year() ? 1 : -1;
};

export const compareDay = (day1, day2) => {
  const compareMonthResult = compareMonth(day1, day2);
  if (compareMonthResult === 0) {
    return dayjs(day1).date() === dayjs(day2).date()
      ? 0
      : dayjs(day1).date() > dayjs(day2).date()
      ? 1
      : -1;
  }
  return compareMonthResult;
};

export const cloneDate = (date) => dayjs(date);

export const cloneDates = (dates) =>
  Array.isArray(dates) ? dates.map(cloneDate) : cloneDate(dates);

export function getTimeByOffset(date, offset, type = "day") {
  if (offset >= 0) {
    return dayjs(date).add(Math.abs(offset), type);
  } else {
    return dayjs(date).subtract(Math.abs(offset), type);
  }
}

export const getPrevDay = (date) => getTimeByOffset(date, -1, "day");
export const getNextDay = (date) => getTimeByOffset(date, 1, "day");

export const getPrevMonth = (date) => getTimeByOffset(date, -1, "month");
export const getNextMonth = (date) => getTimeByOffset(date, 1, "month");

export const getPrevYear = (date) => getTimeByOffset(date, -1, "year");
export const getNextYear = (date) => getTimeByOffset(date, 1, "year");

export const getToday = () =>
  dayjs().hour(0).minute(0).second(0).millisecond(0);

export function calcDateNum(date = [0, 0]) {
  const day1 = dayjs(date[0]).valueOf();
  const day2 = dayjs(date[1]).valueOf();
  return (day2 - day1) / (1000 * 60 * 60 * 24) + 1;
}
