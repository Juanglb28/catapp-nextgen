"use client";

import { useEffect } from "react";

import { subscribeThisDevice } from "@/modules/push/subscribe-client";

/**
 * Intento silencioso de suscribir el dispositivo al cargar la app autenticada.
 * Si falla (sin soporte, permiso denegado o falta la clave pública en el
 * build) no bloquea nada: la usuaria puede activarlo a mano desde
 * Ajustes → Notificaciones, que sí muestra el motivo del fallo.
 */
export function PushManager() {
  useEffect(() => {
    void subscribeThisDevice();
  }, []);

  return null;
}
