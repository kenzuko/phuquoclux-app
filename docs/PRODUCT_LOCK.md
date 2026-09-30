# PhuQuocLux App — Product Lock
Version: V0.1 — 29/09/2026

## One-sentence definition

**PhuQuocLux is a map-first mass travel marketplace for Phu Quoc: the map helps travelers see and discover what is around them, search and categories help them find what they already want, and a reliable commerce and local operations engine lets them book and use those services with minimal friction.**

## Locked principles

1. Mass-market consumer product.
2. Map is the primary visual and marketing backbone.
3. Map is not the commerce or database backbone.
4. Search and categories remain first-class.
5. Nobody must understand the map in order to buy.
6. Home keeps the large embedded map direction from the original design.
7. Full Map is a separate deeper exploration state.
8. Product and MapEntity are separate domains.
9. Product, Offer, Availability, Quote, Booking and Payment are separate concepts.
10. Tours, attraction tickets and transfers are the first native-commerce priorities.
11. Hotels and flights must not force OTA/GDS-level complexity into V1.
12. Open Phu Quoc remains a separate public destination-intelligence product.
13. PhuQuocLux consumes relevant shared destination data without forking Weather/Airport/Transit/Near Me.
14. Modular monolith first. No premature microservices.
15. AI chatbot is not part of the core V1 architecture.
16. My Bookings / post-purchase is first-class.
17. Never fake real-time inventory.
18. Scope discipline beats feature count.

## Core user paths

### Known intent

```
Search / Category
      ↓
Results
      ↓
Product
      ↓
Book
```

### Discovery

```
Map
 ↓
Area / Place
 ↓
Relevant services
 ↓
Product
 ↓
Book
```

## Product hierarchy

```
MAP / SEARCH / CATEGORY
          ↓
      DISCOVERY
          ↓
       PRODUCT
          ↓
        OFFER
          ↓
       BOOKING
          ↓
      MY BOOKINGS
          ↓
   SUPPORT / REPEAT BUY
```

## Home direction

```
Brand / destination
Search
Date + Guests
Map filters
Large embedded map
Quick services
Recommendations
Supporting content
```

## Map behavior

- Search updates the map.
- Category filters update map + result list.
- “Search this area” queries the current viewport.
- Home map is lightweight and scroll-friendly.
- Full map enables deeper pan/zoom, clustering, routes and bottom-sheet browsing.
- Map pins are progressively disclosed by zoom level.
- Do not render every POI at island zoom.

## Data separation

```
MapEntity
 ├── Area
 ├── Place
 ├── Attraction
 ├── Hotel
 ├── Restaurant
 ├── TransportHub
 ├── PickupPoint
 └── ExperienceAnchor

Product
 ├── Tour
 ├── Ticket
 ├── Transfer
 ├── Hotel
 └── other vertical types
```

Products may link to one or many MapEntities. They are never the same object.

## V1 depth

### Native
- Tours / Experiences
- Attraction Tickets
- Transfers

### Conditional
- Ferry / Fast ferry

### Progressive / partner-first
- Hotels
- Flights

### Discovery-first
- Restaurants / Food / Places

### Secondary
- Bespoke request

## Technical direction

```
Web / Mobile
     ↓
JoTrip / PhuQuocLux API-BFF
     ↓
Discovery | Commerce | Customer
     ↓
PostgreSQL / primary transactional store
     ↓
Provider adapters
```

Keep the implementation modular but initially deployable as a modular monolith.
