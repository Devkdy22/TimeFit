import { useNavigationHelper } from '../../../utils/navigation';
import { useSearchState } from '../hooks/useSearchState';
import { SearchView } from './SearchView';

export function SearchContainer() {
  const nav = useNavigationHelper();
  const state = useSearchState();

  return (
    <SearchView
      activeField={state.activeField}
      arrivalAt={state.arrivalAt}
      recentDestinations={state.recentDestinationCards}
      originInput={state.originInput}
      destinationInput={state.destinationInput}
      fieldSuggestions={state.fieldSuggestions}
      isSearchingFieldSuggestions={state.isSearchingFieldSuggestions}
      mapQuery={state.mapQuery}
      mapSearchResults={state.mapSearchResults}
      isSearchingMap={state.isSearchingMap}
      mapCenter={state.mapCenter}
      kakaoJsKey={state.kakaoJsKey}
      onSelectField={state.handleSelectField}
      onChangeArrivalAt={state.setArrivalAt}
      onChangeOriginInput={state.setOriginInput}
      onChangeDestinationInput={state.setDestinationInput}
      onBlurField={state.handleBlurField}
      onChangeMapQuery={state.setMapQuery}
      onSelectMapResult={state.selectPlaceForActiveField}
      onSelectRecentDestination={state.selectRecentDestination}
      onMapCenterChange={state.setMapCenter}
      onGeocodeResult={state.handleGeocodeResult}
      onApplyMapCenter={state.applyMapCenterToActiveField}
      onPressRecommendation={nav.goToRecommendation}
      onClose={nav.goBack}
    />
  );
}
