// すべてのテストを基準日時（elecxstock の TEST_NOW）で動かす。時刻を止めずにずらすので、タイマーはそのまま動く
import { shiftClock, TEST_NOW } from '@shared/clock'

shiftClock(Date.parse(TEST_NOW) - Date.now())
