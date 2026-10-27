// js/airfields/index.js
import { airfieldData as anapa } from './anapa/index.js';
import { airfieldData as krymsk } from './krymsk/index.js';
import { airfieldData as gelendzhik } from './gelendzhik/index.js';
import { airfieldData as novorossiysk } from './novorossiysk/index.js';
import { airfieldData as krasnodarCenter } from './krasnodar_center/index.js';
import { airfieldData as krasnodarPash } from './krasnodar_pash/index.js';
import { airfieldData as maykop } from './maykop/index.js';
import { airfieldData as sochi } from './sochi/index.js';
import { airfieldData as gudauta } from './gudauta/index.js';
import { airfieldData as sukhumi } from './sukhumi/index.js';
import { airfieldData as senaki } from './senaki/index.js';
import { airfieldData as kutaisi } from './kutaisi/index.js';
import { airfieldData as kobuleti } from './kobuleti/index.js';
import { airfieldData as batumi } from './batumi/index.js';
import { airfieldData as minVody } from './min_vody/index.js';
import { airfieldData as nalchik } from './nalchik/index.js';
import { airfieldData as beslan } from './beslan/index.js';
import { airfieldData as mozdok } from './mozdok/index.js';
import { airfieldData as tbilisiLochini } from './tbilisi_lochini/index.js';
import { airfieldData as tbilisiSoganlug } from './tbilisi_soganlug/index.js';
import { airfieldData as vaziani } from './vaziani/index.js';

// 各空港の重要度（Tier / 優先順位）をIDベースで一括定義
const AIRFIELD_TIERS = {
    "URKA": "primary",   // Anapa
    "URKW": "primary",   // Krymsk
    "URKK": "primary",   // Krasnodar-Pashkovsky
    "UGKS": "primary",   // Senaki-Kolkhi
    "UGKO": "primary",   // Kutaisi
    "XRMF": "primary",   // Mozdok
    "UGTB": "primary",   // Tbilisi-Lochini
    "UG27": "primary"    // Vaziani
    // ※ここに定義されていない空港は自動的に "secondary" になります
};

// 読み込んだすべての空港データに、統合側で優先順位（Tier）やSAM、陣営を自動付与する
const rawAirfields = [
    anapa, krymsk, gelendzhik, novorossiysk, 
    krasnodarCenter, krasnodarPash, maykop, sochi, 
    gudauta, sukhumi, senaki, kutaisi, 
    kobuleti, batumi, minVody, nalchik, 
    beslan, mozdok, tbilisiLochini, tbilisiSoganlug, vaziani
];

export const CAUCASUS_AIRFIELDS = rawAirfields.map(af => {
    // 1. 優先順位（Tier）の決定（マップに定義があればそれ、なければ secondary）
    const tier = AIRFIELD_TIERS[af.id] || "secondary";

    // 2. Keep the scenario faction defined by the individual airfield record.
    let side = af.side || "red";
    if (af.name.includes("Sochi") || af.name.includes("Sukhumi") || af.name.includes("Gudauta")) {
        side = "neutral";
    }

    // 3. 優先順位（Tier）に応じた防空網（SAM）の自動割り当て
    let samSystem = null;
    if (side !== "neutral") {
        if (tier === "primary") {
            samSystem = side === "red" ? "S-300PS (SA-10)" : "Patriot PAC-3";
        } else {
            samSystem = side === "red" ? "Buk-M1 (SA-11)" : "Hawk / NASAMS";
        }
    }

    return {
        ...af,
        side,
        tier,
        samSystem
    };
});