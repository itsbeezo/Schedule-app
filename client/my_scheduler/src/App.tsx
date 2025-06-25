import React, { useState, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
// import '@fullcalendar/daygrid/main.css';
// import '@fullcalendar/timegrid/main.css';

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
}

export default function App() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  useEffect(() => {
    fetch('/api/events')
      .then(res => res.json())
      .then((data: CalendarEvent[]) => setEvents(data));
  }, []);

  return (
    <div style={{ padding: '1rem' }}>
      <FullCalendar
        plugins={[ dayGridPlugin, timeGridPlugin ]}
        initialView="timeGridWeek"
        events={events}
        editable={true}
        selectable={true}
      />
    </div>
  );
}
