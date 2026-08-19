## Purpose

Defines how an event's location is represented and surfaced: either a real
venue in a real city, or an online event with no physical venue — replacing
the old model where a single `locations` table conflated real cities with a
fake "Online" pseudo-location.

## ADDED Requirements

### Requirement: Cities are real places only
The `cities` table SHALL contain only real geographic cities. It SHALL NOT
contain a row representing "online" or any other non-geographic pseudo-value.

#### Scenario: Listing cities never includes a pseudo-location
- **WHEN** any part of the system reads the list of cities (e.g. to populate
  a venue's city, or a location filter)
- **THEN** every row returned is a real city name, never "Online" or similar

### Requirement: A venue belongs to a real city
Every venue SHALL reference a real city via `city_id`. A venue SHALL NOT
exist without a valid city.

#### Scenario: Creating a venue requires a city
- **WHEN** an admin creates or upserts a venue
- **THEN** the venue is stored with a `city_id` referencing an existing row
  in `cities`

### Requirement: An event is explicitly online or venue-based
Every event SHALL declare whether it is online via a boolean `is_online`
field. An event SHALL NOT rely on a location's name (e.g. "Online") to
signal that it has no physical venue.

#### Scenario: Online event has no venue
- **WHEN** an admin creates an event and marks it online
- **THEN** the event is stored with `is_online = true` and no venue
  association

#### Scenario: In-person event references a venue
- **WHEN** an admin creates an event and selects a venue
- **THEN** the event is stored with `is_online = false` and a valid venue
  reference

#### Scenario: An event cannot be both online and venue-based
- **WHEN** an event is created or updated
- **THEN** the system SHALL NOT allow `is_online = true` together with a
  venue association on the same event

### Requirement: Existing online events are preserved through migration
Every event that was represented under the old model by pointing at the
"Online" pseudo-location SHALL be readable after migration with
`is_online = true` and no location/venue reference, with all other event
data (date, slug, description, etc.) unchanged.

#### Scenario: Pre-migration online event still shows as online
- **WHEN** an event that previously pointed at the "Online" pseudo-location
  is read after this change ships
- **THEN** it has `is_online = true`, no venue, and is otherwise identical to
  before the migration

### Requirement: Non-online events keep their real city
Every event that was represented under the old model by a real venue/city
SHALL be readable after migration with the same venue and, transitively, the
same real city — unaffected by the online/venue-location split.

#### Scenario: Pre-migration in-person event keeps its venue and city
- **WHEN** an event that previously pointed at a real venue is read after
  this change ships
- **THEN** it still resolves to the same venue and the same (now `cities`-
  backed) city
