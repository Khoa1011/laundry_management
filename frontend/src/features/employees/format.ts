export function employeePositionName(position: { nameVi: string; nameEn: string }, language: string) {
  return language.startsWith('en') ? position.nameEn : position.nameVi
}
