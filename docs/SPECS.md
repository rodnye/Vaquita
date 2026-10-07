# Vaquita — Especificación de flujos

## 1. Descripción general

Billetera comunal donde varios usuarios operan para ingresar o extraer dinero, con transparencia total sobre la bóveda y
privacidad sobre los saldos personales.

## 2. Autenticación y usuarios

- Registro y login de usuarios.
- Un usuario existe globalmente y puede pertenecer a varias bóvedas con roles distintos en cada una.

## 3. Bóvedas

- Cualquier usuario autenticado puede crear una bóveda y queda como **propietario**.
- Una bóveda tiene: nombre, descripción, lista de activos configurables, roles/permisos configurables.
- Activos por defecto al crear: `CUP` y `USD`.
- **Propietario único e intransferible salvo transferencia explícita**: no puede ser expulsado ni degradado. Para salir
  debe transferir la propiedad primero.
- El propietario puede agregar activos. Cada activo define: nombre, si es **entero o decimal (máx. 2 decimales)**, y si
  permite **saldo negativo** (por defecto: no).
- Un activo puede **desactivarse** solo si su saldo total es 0. Se **elimina** solo si además no tiene operaciones en el
  historial.

## 4. Roles y permisos

Roles por defecto: `propietario`, `administrador`, `participante`, `invitado`. Configurables **solo por el
propietario**. La matriz por defecto es la aprobada (transparencia total de operaciones, billeteras personales privadas,
invitado de solo lectura, admin gestiona participantes/invitados pero no a otros admins ni al propietario).

Reglas fijas no configurables:

- Solo el propietario edita configuración, roles y permisos.
- El propietario no puede ser expulsado ni degradado.
- La cancelación global de operaciones es un permiso por rol (por defecto: solo propietario).

## 5. Billeteras y activos

- Cada usuario tiene **una sola billetera por bóveda**, con múltiples saldos por activo.
- El saldo personal es **privado**; el total de la bóveda es **público** por activo (`CUP: X`, `USD: Y`). No hay total
  consolidado ni conversión.
- No hay conversión entre activos: se hace como suboperación de extracción + inyección con descripción aclaratoria.
- Operar con un activo inexistente lanza error; la UI no debe permitirlo.

## 6. Invitaciones

- Solo por **ID de usuario**; el usuario debe estar registrado.
- Expiran a las **24 horas**.
- El invitado puede **aceptar o rechazar**; quien la creó (o propietario/admin según permisos) puede **revocarla**.
- Visibles solo para quien las creó.
- Notificaciones en todos los eventos: invitar, aceptar, rechazar, expirar, revocar.
- Sin límite de invitaciones pendientes.

## 7. Operaciones y suboperaciones

**Suboperación:** indica usuario destino, activo, tipo (`inyección` / `extracción`), monto, descripción y si es
**requerida** (por defecto sí). **Estados de suboperación:** `pendiente`, `aceptada`, `rechazada`, `cancelada`.

**Operación:** agrupa suboperaciones. Categorías: `transacción` y `tarea`. **Estados de operación:** `activa`,
`completada` (inmutable), `cancelada`.

Reglas:

- Una operación puede tener **0 suboperaciones** y se le pueden **añadir mientras esté activa**.
- Las suboperaciones **no se modifican**: para cambiarlas se cancela la operación y se crea una nueva.
- Suboperación **rechazada**:
  - Si es **requerida** → cancela toda la operación.
  - Si **no es requerida** → se ignora; la operación puede completarse con el resto.
- Las suboperaciones pendientes **no expiran**.
- Si un usuario es **expulsado**, sus suboperaciones pendientes se **cancelan**.
- Cuando **todas** las suboperaciones requeridas están aceptadas, la operación pasa a `completada` y se vuelve
  **inmutable**.

## 8. Tareas vs. transacciones

- **Transacción:** requiere aceptación de los afectados y **reserva fondos**.
- **Tarea:** es un recordatorio; no requiere aceptación ni reserva fondos.
- Se puede convertir entre ambas mientras la operación esté activa (según permisos).
  - `tarea → transacción`: las suboperaciones pasan a `pendiente` y se reservan fondos.
  - `transacción → tarea`: se liberan las reservas.

## 9. Reserva de fondos

- Al crear una suboperación de **extracción**, se reserva el monto en la billetera del afectado (las inyecciones no
  reservan).
- Se reserva **hasta lo disponible**: si no alcanza, la suboperación se crea igual pero marcada como
  `fondos insuficientes` en la UI.
- Al **aceptar**, se revalida el saldo disponible real. Si no cubre, se lanza error y no se puede aceptar.
- El saldo de la billetera se muestra al dueño como: **total / reservado / disponible**.
- Se puede reservar más de lo disponible (sobregiro temporal), pero nunca aceptar sin fondos.
- La reserva se **libera** al aceptar (se convierte en movimiento definitivo), rechazar, cancelar la suboperación,
  cancelar la operación o expulsar al usuario.
- Se calcula **por suboperación**, no por el neto de la operación.

## 10. Expulsión y salida

- **No se puede expulsar** a un usuario con saldo distinto de cero en ningún activo; primero debe liquidarse.
- Un usuario puede **abandonar** la bóveda solo si su saldo es cero en todos los activos.

## 11. Historial y auditoría

- Operación completada = **inmutable**. Registra: creador, fecha/hora de creación, fecha/hora de aceptación de cada
  suboperación y fecha de cierre.
- Historial visible según permisos; exportación/auditoría restringida por rol.
- Toda acción sensible (cambios de rol, expulsiones, cambios de configuración, cancelaciones) queda auditada con
  usuario, fecha y detalle.

## 12. Notificaciones

Bandeja de notificaciones por usuario para: invitaciones y sus eventos, suboperaciones que te afectan,
aceptación/rechazo de suboperaciones, operación completada o cancelada, cambios de rol, expulsión, cambios de
configuración o activos.

## 13. Concurrencia y validaciones

- Las aceptaciones se resuelven de forma **transaccional** para evitar doble uso de una misma reserva.
- Control de versión sobre operaciones activas para evitar ediciones simultáneas.
- Validaciones de monto: mayor que cero y respetando entero o 2 decimales según el activo.
