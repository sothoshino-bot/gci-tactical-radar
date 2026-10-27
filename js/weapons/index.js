// js/weapons/index.js
import { AIRCRAFT_WEAPONS } from './aircraft.js';
import { INFANTRY_WEAPONS } from './infantry.js';
import { NAVY_WEAPONS } from './navy.js';

// すべての武器定義を統合
export const ALL_WEAPONS = {
    ...AIRCRAFT_WEAPONS,
    ...INFANTRY_WEAPONS,
    ...NAVY_WEAPONS
};

// 武器の軌道（Trajectory）や射程に応じた判定を行う共通関数
export function checkWeaponHit(weapon, distanceNm, altitude) {
    if (distanceNm > weapon.rangeNm) {
        return { inRange: false, hit: false };
    }

    // 軌道ごとの特殊判定（例: シースキミングは低空でレーダーをかいくぐる等）
    if (weapon.trajectory === "sea_skimming" && altitude > 500) {
        // 低空を飛んでいないと迎撃されやすい等の拡張用ロジック
    }

    return { inRange: true, hit: true, damage: weapon.damage };
}