# TimeFit Endpoint Parity

The table reflects the current repository code. The production deployment cannot be treated as matching the repository without an authorized runtime check.

| Feature | Mobile call | Method | API controller | Auth | Contract |
| --- | --- | --- | --- | --- | --- |
| Route candidates | `/routes` | POST | `TripsController.routes` | No | `ApiResponse<RouteCandidatesResult>`; status is `OK` or a provider/application error state |
| Recommendation | `/recommendations/calculate` | POST | `RecommendationController.calculate` | No | `ApiResponse<RecommendationResult>` or typed empty state |
| Walking geometry | `/kakao-local/directions/walk` with four coordinates as query | GET | `KakaoLocalController.walkDirections` | No | `ApiResponse<{ points: ...[] }>` |
| Active trip snapshot | `/trips/:id` | GET | `TripsController.getTrip` | Yes | `ApiResponse<TripSnapshot>` |
| Trip position | `/trips/:id/position` | POST | `TripsController.updatePosition` | Yes | `ApiResponse<TripPositionResult>` |
| Trip app state | `/trips/:id/app-state` | POST | `TripsController.setAppState` | Yes | `ApiResponse<{ tripId, appState }>` |
| Trip SSE | `/trips/:id/events` | SSE GET | `TripsController.events` | Yes | SSE init, movement/status/route events, replay and ping |
| Reroute | No separate mobile request; initiated through trip position/off-route flow | POST position | `TripsController.updatePosition` → trip services | Yes | SSE route update/switch event |
| Routine create | `/routines` | POST | `RoutinesController.create` | Yes | `ApiResponse<RoutineListItem>` |
| Routine list | `/routines` | GET | `RoutinesController.list` | Yes | `ApiResponse<RoutineListItem[]>` |
| Routine update | `/routines/:id` | PATCH | `RoutinesController.update` | Yes | `ApiResponse<RoutineListItem>` |
| Routine delete | `/routines/:id` | DELETE | `RoutinesController.delete` | Yes | `ApiResponse<{ deleted: true }>` |
| Push token | `/notifications/push-token` | POST | `NotificationsController.registerPushToken` | Yes | `ApiResponse<...>` |
| Notification settings | `/notifications/preferences` | GET/PATCH | `NotificationsController.getPreferences/updatePreferences` | Yes | `ApiResponse<NotificationPreferences>` |

The repository contains the walking geometry controller and a dedicated unit test, but this does not prove the deployed Render service contains the same route. Runtime parity remains pending until the authorized QA/production endpoint is checked.
