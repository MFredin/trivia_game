import { createContext } from 'react';

// Which holiday is being drawn, or null. Provided once by App.jsx so a Plate, which is used all over the app, can dress itself without
// every screen having to pass the holiday down to it.
export const HolidayContext = createContext(null);
