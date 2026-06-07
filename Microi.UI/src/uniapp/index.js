import '../theme/index.css';
import MciPage from './components/MciPage.vue';
import MciNavbar from './components/MciNavbar.vue';
import MciButton from './components/MciButton.vue';
import MciCard from './components/MciCard.vue';
import MciSkeleton from './components/MciSkeleton.vue';
import MciDataState from './components/MciDataState.vue';
import MciRichText from './components/MciRichText.vue';

export {
  MciPage,
  MciNavbar,
  MciButton,
  MciCard,
  MciSkeleton,
  MciDataState,
  MciRichText
};

export const components = [
  MciPage,
  MciNavbar,
  MciButton,
  MciCard,
  MciSkeleton,
  MciDataState,
  MciRichText
];

export function install(app) {
  components.forEach((component) => app.component(component.name, component));
}

export default { install };
