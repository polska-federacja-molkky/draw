// =====================================================================
//  LISTA KLUBÓW — dane do wyświetlania herbów w tabeli wyniku losowania
// =====================================================================
//
// Ten plik zawiera TYLKO dane (logika jest w draw.js). Edytuj go, żeby
// dodać/zmienić klub — nie trzeba dotykać reszty kodu.
//
// Jak dodać klub:
//   • bez herbu:  KOD: { name: "Pełna nazwa klubu" }
//                 → w tabeli pokaże się szara tarcza z akronimem "KOD"
//   • z herbem:   KOD: { name: "Pełna nazwa", logo: "logos/KOD.png" }
//                 → najpierw wrzuć plik herbu do folderu logos/
//
// KOD (klucz) = skrót klubu WIELKIMI literami, bez polskich znaków
//   (np. Oława → OLA). Kod z listy uczestników jest automatycznie
//   normalizowany, więc wpis "OŁA" też trafi w klucz "OLA".
//
// Pełna nazwa pojawia się w dymku (tooltip) po najechaniu na herb.
// Eksport do Excela i kopiowanie do schowka zawsze używają skrótu, nie herbu.
// ---------------------------------------------------------------------

const CLUBS = {
  ZAG: { name: "Zagryfka Tczew",              logo: "logos/ZAG.png" },
  DWU: { name: "Dwunastka Warszawa",          logo: "logos/DWU.png" },
  ZAK: { name: "Zakręgleni Szczecin",         logo: "logos/ZAK.png" },
  PUS: { name: "Puszczyki Mölkky Puszczykowo", logo: "logos/PUS.png" },
  SUD: { name: "Suden Vuori",                 logo: "logos/SUD.png" },
  FOR: { name: "KF Format Sztum",             logo: "logos/FOR.png" },
  TIM: { name: "Timbers Bojanowo",            logo: "logos/TIM.png" },
  BES: { name: "Beskid Mölkky Team",          logo: "logos/BES.png" },
  SIL: { name: "AKF Silesia Chorzów",         logo: "logos/SIL.png" },
  FOL: { name: "Festiwal Folkowisko",         logo: "logos/FOL.png" },
  LIS: { name: "LIS-ki Team Gryfów Śląski",   logo: "logos/LIS.png" },
  ZBI: { name: "ŚKKF Zbijaki",                logo: "logos/ZBI.png" },
  SAO: { name: "Stowarzyszenie Aktywny Orlik", logo: "logos/SAO.png" },
  DEM: { name: "Demölkky Gdynia",             logo: "logos/DEM.png" },
  ROS: { name: "Rosengarten Rats Berlin",     logo: "logos/ROS.png" },
  OLA: { name: "Mölkky Oława",                logo: "logos/OLA.png" },
  KSP: { name: "KS Petanque Oława",           logo: "logos/KSP.png" },

  // Kluby bez herbu — pokazują szarą tarczę z akronimem.
  // Dodaj `logo: "logos/KOD.png"` gdy wrzucisz herb.
  LEM: { name: "Lemolki Chojnice" },
  MAT: { name: "Mat4" },
  BPK: { name: "Bez Pudła Kępno" },
};
