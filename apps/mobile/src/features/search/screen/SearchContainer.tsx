import { useSearchState } from '../hooks/useSearchState';
import { SearchView } from './SearchView';
import { useNavigationHelper } from '../../../utils/navigation';

export function SearchContainer() {
  const nav = useNavigationHelper();
  const state = useSearchState();

  return (
    <SearchView
      activeField={state.activeField}
      origin={state.originLabel}
      destination={state.destinationLabel}
      arrivalAt={state.arrivalAt}
      selectedOption={state.selectedOption}
      options={state.options}
      query={state.query}
      preview={state.preview}
      recentPlaces={state.recentPlaces}
      savedPlaces={state.savedPlaces}
      filteredSearchResults={state.filteredSearchResults}
      latestSelectedPlace={state.latestSelectedPlace}
      isSaveNameOpen={state.isSaveNameOpen}
      saveName={state.saveName}
      onChangeQuery={state.setQuery}
      onChangeSaveName={state.setSaveName}
      onSelectField={state.setActiveField}
      onSelectPlace={state.selectPlace}
      onSelectMapSample={state.selectMapSample}
      onOpenSaveName={state.openSaveName}
      onSavePlace={state.savePlace}
      onCancelSavePlace={state.cancelSavePlace}
      onChangeArrivalAt={state.setArrivalAt}
      onSelectOption={state.setSelectedOption}
      onPressRecommendation={nav.goToRecommendation}
      onClose={nav.goBack}
    />
  );
}
