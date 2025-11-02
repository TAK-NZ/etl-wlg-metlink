/**
 * ETL-WLG-METLINK - Wellington public transport vehicle positions
 * 
 * This ETL task fetches real-time vehicle position data from Metlink (Wellington public transport)
 * and transforms it into Cursor-on-Target (CoT) format suitable for display on TAK maps,
 * showing buses and trains in the Greater Wellington area.
 */

import { Type, TSchema } from '@sinclair/typebox';
import { fetch } from '@tak-ps/etl'
import ETL, { Event, SchemaType, handler as internal, local, InvocationType, DataFlowType } from '@tak-ps/etl';

/**
 * Constants used throughout the ETL task
 */
// Special value indicating unknown course in CoT format
const UNKNOWN_COURSE = Number.NaN; // Using NaN per CoT specification for unknown values

/**
 * Icon paths for different vehicle types
 */
const BUS_ICON_PATH = 'ad78aafb-83a6-4c07-b2b9-a897a8b6a38f/Shapes/bus.png';
const TRAIN_ICON_PATH = '34ae1613-9645-4222-a9d2-e5f243dea2865/Transportation/Train4.png';
const SHIP_ICON_PATH = '34ae1613-9645-4222-a9d2-e5f243dea2865/Transportation/Ship.png';

/**
 * Environment configuration schema for the ETL task
 * These parameters can be configured through the CloudTAK interface
 */
const Env = Type.Object({
    'METLINK_API_KEY': Type.String({ 
        description: 'API Key for Metlink OpenData API',
        default: ''
    }),
    'Show_Buses': Type.Boolean({
        description: 'Show buses on the map',
        default: true
    }),
    'Show_Trains': Type.Boolean({
        description: 'Show trains on the map',
        default: true
    }),
    'Show_Ships': Type.Boolean({
        description: 'Show ships/ferries on the map',
        default: true
    }),
    'DEBUG': Type.Boolean({ 
        description: 'Print API results in logs.', 
        default: false 
    })
});

/**
 * Schema for vehicle data returned by the Metlink GTFS-RT API
 * See API documentation: https://api.opendata.metlink.org.nz/
 */
interface VehicleData {
    id: string;
    vehicle: {
        trip: {
            trip_id: string;
            route_id: number;
            direction_id: number;
            start_time: string;
            start_date: string;
            schedule_relationship: number;
        };
        position: {
            latitude: number;
            longitude: number;
            bearing: number;
            speed?: number;
        };
        timestamp: number;
        vehicle: {
            id: string;
        };
        occupancy_status?: number;
        current_stop_sequence?: number;
        stop_id?: string;
        current_status?: number;
    };
}

const MetlinkResponse = Type.Object({
    id: Type.String({
        description: 'Unique identifier for this vehicle position update'
    }),
    vehicle: Type.Object({
        trip: Type.Object({
            trip_id: Type.String({ description: 'Trip identifier' }),
            route_id: Type.Number({ description: 'Route identifier' }),
            direction_id: Type.Number({ description: 'Direction of travel' }),
            start_time: Type.String({ description: 'Trip start time' }),
            start_date: Type.String({ description: 'Trip start date' }),
            schedule_relationship: Type.Number({ description: 'Schedule relationship' })
        }),
        position: Type.Object({
            latitude: Type.Number({ description: 'Vehicle latitude' }),
            longitude: Type.Number({ description: 'Vehicle longitude' }),
            bearing: Type.Number({ description: 'Vehicle bearing in degrees' }),
            speed: Type.Optional(Type.Number({ description: 'Vehicle speed' }))
        }),
        timestamp: Type.Number({ description: 'Position timestamp' }),
        vehicle: Type.Object({
            id: Type.String({ description: 'Vehicle identifier' })
        }),
        occupancy_status: Type.Optional(Type.Number({ description: 'Occupancy status' })),
        current_stop_sequence: Type.Optional(Type.Number({ description: 'Current stop sequence' })),
        stop_id: Type.Optional(Type.String({ description: 'Current stop ID' })),
        current_status: Type.Optional(Type.Number({ description: 'Current status' }))
    })
})

/**
 * Main ETL task class for processing Metlink vehicle position data
 * Fetches vehicle data, transforms it, and submits it to CloudTAK
 */
export default class Task extends ETL {
    static name = 'etl-wlg-metlink'
    static flow = [ DataFlowType.Incoming ];
    static invocation = [ InvocationType.Schedule ];

    async schema(
        type: SchemaType = SchemaType.Input,
        flow: DataFlowType = DataFlowType.Incoming
    ): Promise<TSchema> {
        if (flow === DataFlowType.Incoming) {
            if (type === SchemaType.Input) {
                return Env;
            } else {
                return MetlinkResponse;
            }
        } else {
            return Type.Object({});
        }
    }



    /**
     * Main control function that executes the ETL process
     * 1. Fetches vehicle data from Metlink API
     * 2. Processes and transforms the data
     * 3. Submits the data to CloudTAK
     */
    async control() {
        const env = await this.env(Env);

        const url = 'https://api.opendata.metlink.org.nz/v1/gtfs-rt/vehiclepositions';

        // Fetch vehicle data from Metlink with error handling
        let body;
        try {
            const res = await fetch(url, {
                headers: {
                    'accept': 'application/json',
                    'x-api-key': env.METLINK_API_KEY
                }
            });
            
            if (!res.ok) {
                throw new Error(`Metlink API returned status ${res.status}: ${res.statusText}`);
            }
            
            // Get the raw response first
            const rawResponse = await res.json();
            
            if (env.DEBUG) {
                console.log('Raw API response:', JSON.stringify(rawResponse).substring(0, 1000) + '...');
            }
            
            // Validate response structure
            if (rawResponse && typeof rawResponse === 'object' && 'entity' in rawResponse && Array.isArray(rawResponse.entity)) {
                body = rawResponse as { entity: VehicleData[], header: Record<string, unknown> };
                console.log(`ok - Received ${body.entity.length} vehicles from API`);
            } else {
                throw new Error('Invalid API response format: missing entity data');
            }
        } catch (error) {
            console.error(`Error fetching Metlink data: ${error.message}`);
            // Return empty feature collection on error
            await this.submit({
                type: 'FeatureCollection',
                features: []
            });
            return;
        }

        // Map to store processed vehicle data by ID
        const ids = new Map();

        // Process each vehicle from the API response
        for (const entity of body.entity) {
            if (!entity.vehicle || !entity.vehicle.position) continue;

            const vehicle = entity.vehicle;
            const position = vehicle.position;
            const trip = vehicle.trip;
            
            const coordinates = [position.longitude, position.latitude];

            // Extract correct route ID from trip_id (first element before first '__')
            const correctRouteId = trip.trip_id.split('__')[0];

            // Determine vehicle type based on trip_id prefix
            // QDF: Ship/Ferry
            // HVL, JVL, KPL, MEL, WRL, MUL: Trains (various rail lines)
            // AX: Bus (Airport Express)
            // Numbers: Bus
            let vehicleType: string;
            let icon: string;
            let cotType: string;
            let markerColor: string;
            
            if (trip.trip_id.startsWith('QDF')) {
                vehicleType = 'Ship';
                icon = SHIP_ICON_PATH;
                cotType = 'a-f-S-E-V'; // Ship CoT type (friendly surface equipment vehicle)
                markerColor = '#0093b2';
            } else if (trip.trip_id.startsWith('HVL') || trip.trip_id.startsWith('JVL') || 
                       trip.trip_id.startsWith('KPL') || trip.trip_id.startsWith('MEL') || 
                       trip.trip_id.startsWith('WRL') || trip.trip_id.startsWith('MUL')) {
                vehicleType = 'Train';
                icon = TRAIN_ICON_PATH;
                cotType = 'a-u-G-E-V'; // Train CoT type as specified
                markerColor = '#784e90';
            } else {
                vehicleType = 'Bus';
                icon = BUS_ICON_PATH;
                cotType = 'a-f-G-E-V-C'; // Bus CoT type (friendly ground equipment vehicle - civilian)
                markerColor = '#4e801f';
            }
            
            // Skip vehicles based on show/hide settings
            if ((vehicleType === 'Bus' && !env.Show_Buses) ||
                (vehicleType === 'Train' && !env.Show_Trains) ||
                (vehicleType === 'Ship' && !env.Show_Ships)) {
                continue;
            }
            
            const cotId = `WLG-Metlink${vehicleType}-${vehicle.vehicle.id}`;

            // Helper function to build structured remarks for vehicles
            function buildVehicleRemarks(vehicleData: VehicleData): string {
                const remarksObj: Record<string, string> = {
                    'Vehicle Type': vehicleType,
                    'Vehicle ID': vehicleData.vehicle.vehicle.id,
                    'Route ID': correctRouteId,
                    'Trip ID': vehicleData.vehicle.trip.trip_id,
                    'Direction': (vehicleData.vehicle.trip.direction_id ?? 'Unknown').toString(),
                    'Start Time': vehicleData.vehicle.trip.start_time
                };
                
                // Add occupancy status if available
                if (vehicleData.vehicle.occupancy_status !== undefined) {
                    const occupancyMap: Record<number, string> = {
                        0: 'Empty',
                        1: 'Many seats available',
                        2: 'Few seats available',
                        3: 'Standing room only',
                        4: 'Crushed standing room only',
                        5: 'Full',
                        6: 'Not accepting passengers'
                    };
                    remarksObj['Occupancy'] = occupancyMap[vehicleData.vehicle.occupancy_status] || 'Unknown';
                }
                
                // Add speed if available
                if (vehicleData.vehicle.position.speed !== undefined) {
                    remarksObj['Speed'] = `${vehicleData.vehicle.position.speed.toFixed(1)} m/s`;
                }
                
                return Object.entries(remarksObj)
                    .map(([key, value]) => `${key}: ${value}`)
                    .join('\n');
            }
            
            // Prepare the feature properties with enhanced metadata
            const properties = {
                type: cotType,
                callsign: `Route ${correctRouteId} - ${vehicleType} ${vehicle.vehicle.id}`,
                time: new Date(vehicle.timestamp * 1000),
                start: new Date(vehicle.timestamp * 1000),
                speed: position.speed || Number.NaN,
                course: position.bearing || UNKNOWN_COURSE,
                'marker-color': markerColor,
                metadata: {
                    ...entity,
                    vehicleType,
                    routeId: correctRouteId,
                    directionId: trip.direction_id,
                    vehicleId: vehicle.vehicle.id,
                    occupancy: vehicle.occupancy_status !== undefined ? 
                        (['Empty', 'Many seats available', 'Few seats available', 'Standing room only', 
                          'Crushed standing room only', 'Full', 'Not accepting passengers'][vehicle.occupancy_status] || 'Unknown') : 'Unknown'
                },
                remarks: buildVehicleRemarks(entity),
                icon: icon
            };
            
            ids.set(cotId, {
                id: cotId,
                type: 'Feature',
                properties: properties,
                geometry: {
                    type: 'Point',
                    coordinates
                }
            });
        }

        // Prepare array for the final feature collection
        const features = [];
        
        // Include all vehicles (no filtering needed for public transport)
        for (const feat of ids.values()) {
            features.push(feat);
        }

        // Log the number of vehicles processed
        console.log(`ok - processed ${ids.size} valid vehicles (from ${body.entity.length} total)`);
        
        // Create the final GeoJSON feature collection to submit
        const fc = {
            type: 'FeatureCollection' as const,
            features
        };

        console.log(`ok - submitting ${features.length} features to CloudTAK`);
        await this.submit(fc as unknown as Parameters<typeof this.submit>[0]);
    }
}

// For local development testing
await local(new Task(import.meta.url), import.meta.url);

// AWS Lambda handler function
export async function handler(event: Event = {}) {
    return await internal(new Task(import.meta.url), event);
}