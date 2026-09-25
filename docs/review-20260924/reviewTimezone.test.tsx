import { act, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import App from './App';
import { initializeLocalUser } from './api/entities';
import { dateInZone } from './features/schedules/timeRange';
vi.mock('./api/entities', async original=>({...await original<typeof import('./api/entities')>(),initializeLocalUser:vi.fn()}));
vi.mock('./api/schedules', async original=>({...await original<typeof import('./api/schedules')>(),getRangeSchedules:vi.fn().mockResolvedValue([])}));
afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();});
it('REVIEW: calendar initially selects the saved-zone date',async()=>{
 vi.useFakeTimers(); const now = new Date(2026,8,24,0,30);vi.setSystemTime(now);
 const zone='Pacific/Honolulu'; const expected=dateInZone(zone,now);
 vi.mocked(initializeLocalUser).mockResolvedValue(zone);
 window.history.replaceState(null,'','#/calendar');vi.spyOn(window,'scrollTo').mockImplementation(()=>{});
 await act(async()=>{render(<App/>);});
 console.log('REVIEW timezone', {expected, actual:screen.getByRole('link',{name:'이 날짜에 일정 만들기'}).getAttribute('href')});
 expect(screen.getByRole('link',{name:'이 날짜에 일정 만들기'})).toHaveAttribute('href','#/schedules/new?date='+expected);
});
