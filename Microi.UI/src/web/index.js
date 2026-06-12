import '../theme/index.css';
import MciPage from './components/MciPage.vue';
import MciHeroPanel from './components/MciHeroPanel.vue';
import MciBottomNav from './components/MciBottomNav.vue';
import MciButton from './components/MciButton.vue';
import MciCard from './components/MciCard.vue';
import MciCell from './components/MciCell.vue';
import MciSection from './components/MciSection.vue';
import MciThemePanel from './components/MciThemePanel.vue';
import MciTabs from './components/MciTabs.vue';
import MciMetricCard from './components/MciMetricCard.vue';
import MciActionBar from './components/MciActionBar.vue';
import MciAvatar from './components/MciAvatar.vue';
import MciProductCard from './components/MciProductCard.vue';
import MciFormField from './components/MciFormField.vue';
import MciFilterBar from './components/MciFilterBar.vue';
import MciAssetCard from './components/MciAssetCard.vue';
import MciOrderCard from './components/MciOrderCard.vue';
import MciModal from './components/MciModal.vue';
import MciUploader from './components/MciUploader.vue';
import MciTimeline from './components/MciTimeline.vue';
import MciSteps from './components/MciSteps.vue';
import MciSkeleton from './components/MciSkeleton.vue';
import MciDataState from './components/MciDataState.vue';
import MciRichText from './components/MciRichText.vue';
export {
  applyMciDesign,
  getMciDesign,
  initMciDesign,
  setMciMotion,
  setMciPalette,
  setMciShape,
  setMciTheme,
  toggleMciTheme
} from '../theme/runtime.js';

export {
  MciPage,
  MciHeroPanel,
  MciBottomNav,
  MciButton,
  MciCard,
  MciCell,
  MciSection,
  MciThemePanel,
  MciTabs,
  MciMetricCard,
  MciActionBar,
  MciAvatar,
  MciProductCard,
  MciFormField,
  MciFilterBar,
  MciAssetCard,
  MciOrderCard,
  MciModal,
  MciUploader,
  MciTimeline,
  MciSteps,
  MciSkeleton,
  MciDataState,
  MciRichText
};

export const components = [
  MciPage,
  MciHeroPanel,
  MciBottomNav,
  MciButton,
  MciCard,
  MciCell,
  MciSection,
  MciThemePanel,
  MciTabs,
  MciMetricCard,
  MciActionBar,
  MciAvatar,
  MciProductCard,
  MciFormField,
  MciFilterBar,
  MciAssetCard,
  MciOrderCard,
  MciModal,
  MciUploader,
  MciTimeline,
  MciSteps,
  MciSkeleton,
  MciDataState,
  MciRichText
];

export function install(app) {
  components.forEach((component) => app.component(component.name, component));
}

export default { install };
