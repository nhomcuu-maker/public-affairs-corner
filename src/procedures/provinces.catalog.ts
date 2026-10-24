import { BadRequestException } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

interface Province { code: string; name: string }
interface Catalog { source: string; sourceUrl: string; effectiveFrom: string; provinces: Province[] }

// Data source is bundled with the project, not trusted from user input or a third-party API.
const catalog = JSON.parse(readFileSync(join(process.cwd(), 'data', 'tinh_thanh_2025.json'), 'utf8')) as Catalog;
if (catalog.provinces.length !== 34 ||
    new Set(catalog.provinces.map(p => p.code)).size !== 34 ||
    catalog.provinces.some(p => !/^\d{2}$/.test(p.code) || !p.name)) {
  throw new Error('Invalid province catalog: verify Quyết định 19/2025/QĐ-TTg');
}
export function getProvinceCatalog(): Catalog { return catalog; }
export function parseProvinceCode(input: string | undefined): string | null {
  if (input === undefined) return null;
  if (typeof input !== 'string' || !/^\d{2}$/.test(input) || !catalog.provinces.some(p => p.code === input)) {
    throw new BadRequestException('Mã tỉnh/thành phố không hợp lệ. Sử dụng mã 2 chữ số hiện hành.');
  }
  return input;
}
