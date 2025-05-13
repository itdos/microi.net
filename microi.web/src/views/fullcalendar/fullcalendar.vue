<template>
  <!--
        @tab-click="WorkTypeChange" -->
  <el-tabs id="table-rowlist-tabs" v-model="TabType" type="border-card">
    <el-tab-pane :name="'Calendar'" :lazy="true">
      <span slot="label">
        <i :class="'fas fa-list-ol marginRight5'" />
        <template>
          {{ "日历视图" }}
        </template>
      </span>
      <div class="fullcalendar-container">
        <FullCalendar class="demo-app-calendar" :options="calendarOptions">
          <template v-slot:eventContent="arg">
            <b>{{ arg.timeText + 123 }}</b>
            <i>{{ arg.event.title + 456 }}</i>
          </template>
        </FullCalendar>
      </div>
    </el-tab-pane>
    <el-tab-pane :name="'Table'" :lazy="true">
      <span slot="label">
        <i :class="'fas fa-list-ol marginRight5'" />
        <template>
          {{ "表格视图" }}
        </template>
      </span>
      2222
    </el-tab-pane>
  </el-tabs>
</template>

<script>
import FullCalendar from "@fullcalendar/vue";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import zhLocale from "@fullcalendar/core/locales/zh-cn";
import { INITIAL_EVENTS, createEventId } from "./event-utils";

export default {
  components: {
    FullCalendar // make the <FullCalendar> tag available
  },

  data: function () {
    return {
      TabType: "Calendar",
      calendarOptions: {
        plugins: [
          dayGridPlugin,
          timeGridPlugin,
          interactionPlugin // needed for dateClick
        ],
        headerToolbar: {
          left: "prev,next today",
          center: "title",
          right: "dayGridMonth,timeGridWeek,timeGridDay"
        },
        locales: [zhLocale],
        initialView: "dayGridMonth",
        initialEvents: INITIAL_EVENTS, // alternatively, use the `events` setting to fetch from a feed
        editable: true,
        selectable: true,
        selectMirror: true,
        dayMaxEvents: true,
        weekends: true,
        select: this.handleDateSelect,
        eventClick: this.handleEventClick,
        eventsSet: this.handleEvents
        /* you can update a remote database when these fire:
        eventAdd:
        eventChange:
        eventRemove:
        */
      },
      currentEvents: []
    };
  },

  methods: {
    handleWeekendsToggle() {
      this.calendarOptions.weekends = !this.calendarOptions.weekends; // update a property
    },

    handleDateSelect(selectInfo) {
      let title = prompt("Please enter a new title for your event");
      let calendarApi = selectInfo.view.calendar;

      calendarApi.unselect(); // clear date selection

      if (title) {
        calendarApi.addEvent({
          id: createEventId(),
          title,
          start: selectInfo.startStr,
          end: selectInfo.endStr,
          allDay: selectInfo.allDay
        });
      }
    },

    handleEventClick(clickInfo) {
      if (confirm(`Are you sure you want to delete the event '${clickInfo.event.title}'`)) {
        clickInfo.event.remove();
      }
    },

    handleEvents(events) {
      this.currentEvents = events;
    }
  }
};
</script>

<style lang="css">
.fullcalendar-container {
  padding: 20px;
  background-color: #fff;
}
</style>
