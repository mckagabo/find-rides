import { Client, Databases, Query } from 'node-appwrite';

export default async function(req, res) {
    const client = new Client();
    const database = new Databases(client);

    client
    .setEndpoint(process.env.APPWRITE_FUNCTION_ENDPOINT) // Your Appwrite endpoint
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID) // Project ID from the function environment
    .setKey(process.env.APPWRITE_API_KEY);

    const userPickupLat = req.payload.fromLatitude;
    const userPickupLon = req.payload.fromLongitude;
    const userDestLat = req.payload.toLatitude;
    const userDestLon = req.payload.toLongitude;
    const limit = req.payload.limit || 10; // Default to 10 items per page
    const offset = req.payload.offset || 0; // Default to the first page

    try {
        // Fetch rides with pagination
        const rides = await database.listDocuments(process.env.DATABASE_ID, process.env.COLLECTION_ID, [
            Query.limit(limit),
            Query.offset(offset),
        ]);

        // Calculate distances for both pickup and destination locations
        const ridesWithDistances = rides.documents.map(ride => {
            const pickupDistance = getDistanceFromLatLon(
                userPickupLat, userPickupLon,
                ride.originCoordinate[0], ride.originCoordinate[1]
            );
            const destinationDistance = getDistanceFromLatLon(
                userDestLat, userDestLon,
                ride.destinationCoordinates[0], ride.destinationCoordinates[1]
            );
            const combinedDistance = pickupDistance + destinationDistance;

            return { ...ride, pickupDistance, destinationDistance, combinedDistance };
        });

        // Filter rides that are within a reasonable distance (e.g., 10 km) for both pickup and destination
        const filteredRides = ridesWithDistances.filter(ride =>
            ride.pickupDistance <= 10 && ride.destinationDistance <= 10
        );

        // Sort the filtered rides by combined distance (pickup + destination)
        filteredRides.sort((a, b) => a.combinedDistance - b.combinedDistance);

        res.json({
            rides: filteredRides,
            total: rides.total, // Total number of rides in the collection
            limit: limit,
            offset: offset,
        });
    } catch (error) {
        res.json({ error: error.message });
    }
}

// Include the Haversine formula function here for distance calculations
function getDistanceFromLatLon(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the Earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in km
    return distance;
}

function deg2rad(deg) {
    return deg * (Math.PI / 180);
}
