// Shows whether a frame is one of several selected (hooks/frame-selection.js) by setting data-frame-selected on the element it sits in
// (the frame's box; each tab's CSS outlines it). It renders nothing itself: the selection is read here, not in the tab's template, so a
// click that selects frames updates these marks and not the whole tab (the Title and Sprites tabs re-rendered every card and canvas on each
// click before).
export default {
  name: 'FrameSelectMark',
  props: {
    // Whether the frame is selected: called here, so only this mark depends on the selection.
    selected: {type: Function, required: true},
  },
  computed: {
    on() {
      return !!this.selected();
    },
  },
  watch: {
    on() {
      this.apply();
    },
  },
  mounted() {
    this.apply();
  },
  beforeDestroy() {
    const box = this.$el && this.$el.parentNode;
    if (box && box.removeAttribute) box.removeAttribute('data-frame-selected');
  },
  methods: {
    apply() {
      const box = this.$el && this.$el.parentNode;
      if (!box || !box.setAttribute) return;
      if (this.on) box.setAttribute('data-frame-selected', '');
      else box.removeAttribute('data-frame-selected');
    },
  },
  render(h) {
    return h();
  },
};
