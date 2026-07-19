/**
 * Lógica pura de inventario (F7.B1). Sin DB.
 */

/**
 * Un producto está en "stock bajo" si tiene un mínimo configurado (> 0) y su
 * stock cayó hasta ese mínimo o por debajo. Sin mínimo (0) no se alerta.
 */
export function isLowStock(stock: number, minStock: number): boolean {
  return minStock > 0 && stock <= minStock;
}

/** Delta que un movimiento aplica al stock según su tipo. */
export function movementDelta(
  type: "in" | "out" | "adjust",
  quantity: number,
): number {
  // 'in' suma; 'out' resta; 'adjust' ya trae el delta con signo.
  return type === "out" ? -quantity : quantity;
}

/**
 * Delta de un ajuste: el sistema cuenta el valor REAL contado y calcula cuánto
 * sumar/restar para llegar a él desde el stock actual. F7.B2.
 */
export function adjustDelta(realStock: number, currentStock: number): number {
  return realStock - currentStock;
}
