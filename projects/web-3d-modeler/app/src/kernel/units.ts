/**
 * 길이 단위 변환·표기 (순수 함수 — 단위테스트 가능).
 * 내부 좌표·치수는 항상 mm 기준. 표시할 때만 사용자 단위로 변환한다.
 * (Shapr3D 식 단위 토글 대응 — 미터법/인치)
 */

export type LengthUnit = "mm" | "cm" | "m" | "in" | "ft";

/** mm → 해당 단위 1개의 mm 값 (나누는 수). */
const PER_UNIT_MM: Record<LengthUnit, number> = {
  mm: 1,
  cm: 10,
  m: 1000,
  in: 25.4,
  ft: 304.8,
};

/** 단위별 표시 소수 자릿수 — 큰 단위일수록 더 많은 자릿수로 정밀도 보존. */
const DECIMALS: Record<LengthUnit, number> = {
  mm: 2,
  cm: 2,
  m: 3,
  in: 3,
  ft: 3,
};

/** 단위 접미 기호. */
const SUFFIX: Record<LengthUnit, string> = {
  mm: "mm",
  cm: "cm",
  m: "m",
  in: "in",
  ft: "ft",
};

/** mm 값을 사용자 단위로 변환한 숫자 (반올림 전 원시값). */
export function convertLength(mm: number, unit: LengthUnit): number {
  return mm / PER_UNIT_MM[unit];
}

/** 사용자 단위 값을 내부 mm 로 되돌린다 (입력 박스 → 스토어 커밋용). */
export function toMm(value: number, unit: LengthUnit): number {
  return value * PER_UNIT_MM[unit];
}

/**
 * mm 값을 "12.00 mm" 같은 표시 문자열로. opts.prefix 로 ⌀(지름) 같은 접두 기호를 붙인다.
 * opts.suffix=false 면 단위 기호 생략(입력 박스 옆에 따로 단위를 둘 때).
 */
export function formatLength(
  mm: number,
  unit: LengthUnit,
  opts?: { prefix?: string; suffix?: boolean },
): string {
  const v = convertLength(mm, unit).toFixed(DECIMALS[unit]);
  const prefix = opts?.prefix ?? "";
  const suffix = opts?.suffix === false ? "" : ` ${SUFFIX[unit]}`;
  return `${prefix}${v}${suffix}`;
}

/** 단위 기호만 (입력 박스 옆 라벨용). */
export function unitSuffix(unit: LengthUnit): string {
  return SUFFIX[unit];
}
