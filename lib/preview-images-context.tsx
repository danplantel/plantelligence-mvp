"use client";

import { createContext } from "react";

export const PreviewImagesContext = createContext<Record<number, string>>({});
