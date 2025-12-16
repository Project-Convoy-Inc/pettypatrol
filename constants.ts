import { Behavior, Badge, Deal } from './types';

export const BEHAVIORS: Behavior[] = [
  { id: 'lane_leaper', name: 'Lane Leaper', description: 'Changing lanes without looking.', icon: '⚡' },
  { id: 'unhinged_honker', name: 'Unhinged Honker', description: 'Honking at nothing.', icon: '📢' },
  { id: 'texting_zombie', name: 'Texting Zombie', description: 'Eyes on the phone, not the road.', icon: '🧟' },
  { id: 'road_rager', name: 'Road Rager', description: 'Yelling or aggressive driving.', icon: '🤬' },
  { id: 'no_signal_phantom', name: 'No-Signal Phantom', description: 'Never uses turn signals.', icon: '👻' },
  { id: 'stop_sign_skipper', name: 'Stop Sign Skipper', description: 'Rolling through stops.', icon: '🛑' },
  { id: 'parking_menace', name: 'Parking Menace', description: 'Taking two spots or blocking.', icon: '🅿️' },
  { id: 'speed_demon', name: 'Speed Demon', description: 'Way too fast for conditions.', icon: '🏎️' },
  { id: 'turtle_mode', name: 'Turtle Mode', description: 'Driving painfully slow.', icon: '🐢' },
  { id: 'traffic_blocker', name: 'Traffic Blocker', description: 'Blocking the box.', icon: '🧱' },
  { id: 'other_custom', name: 'Other', description: 'Something else? Write it down.', icon: '✍️' },
];

export const INITIAL_BADGES: Badge[] = [
  { id: 'first_catch', name: 'First Catch', description: 'Your first-ever report.', unlocked: false, icon: '🛡️', requiredBehaviorId: undefined },
  { id: 'lane_leaper', name: 'Weaver', description: 'Caught a Lane Leaper.', unlocked: false, icon: '⚡', requiredBehaviorId: 'lane_leaper' },
  { id: 'honker', name: 'Silencer', description: 'Caught an Unhinged Honker.', unlocked: false, icon: '📢', requiredBehaviorId: 'unhinged_honker' },
  { id: 'zombie', name: 'Eye Opener', description: 'Caught a Texting Zombie.', unlocked: false, icon: '🧟', requiredBehaviorId: 'texting_zombie' },
  { id: 'rager', name: 'Zen Master', description: 'Caught a Road Rager.', unlocked: false, icon: '🤬', requiredBehaviorId: 'road_rager' },
  { id: 'phantom', name: 'Ghostbuster', description: 'Caught a No-Signal Phantom.', unlocked: false, icon: '👻', requiredBehaviorId: 'no_signal_phantom' },
  { id: 'skipper', name: 'Full Stop', description: 'Caught a Stop Sign Skipper.', unlocked: false, icon: '🛑', requiredBehaviorId: 'stop_sign_skipper' },
  { id: 'menace', name: 'Space Saver', description: 'Caught a Parking Menace.', unlocked: false, icon: '🅿️', requiredBehaviorId: 'parking_menace' },
  { id: 'demon', name: 'Speed Trap', description: 'Caught a Speed Demon.', unlocked: false, icon: '🏎️', requiredBehaviorId: 'speed_demon' },
  { id: 'turtle', name: 'Pace Maker', description: 'Caught a Turtle Mode driver.', unlocked: false, icon: '🐢', requiredBehaviorId: 'turtle_mode' },
  { id: 'blocker', name: 'Unblocker', description: 'Caught a Traffic Blocker.', unlocked: false, icon: '🧱', requiredBehaviorId: 'traffic_blocker' },
  { id: 'legendary', name: 'Ultimate Miami Driver', description: 'Caught a driver doing EVERYTHING wrong.', unlocked: false, icon: '😱', requiredBehaviorId: undefined },
];

export const INITIAL_DEALS: Deal[] = [
  { id: 'joe_crab', partnerName: "Joe's Stone Crab Shack", offer: "Free Key Lime Pie", description: "With any entree purchase", qrCodeId: "PARTNER_JOE", claimed: false, color: "bg-red-50", location: "11 Washington Ave" },
  { id: 'cafe_cubano', partnerName: "Café Cubano Express", offer: "BOGO Colada", description: "Buy one get one free", qrCodeId: "PARTNER_CUBANO", claimed: false, color: "bg-orange-50", location: "8th St & Ocean Dr" },
  { id: 'ocean_tacos', partnerName: "Ocean Drive Tacos", offer: "15% Off Tacos", description: "Valid for lunch only", qrCodeId: "PARTNER_TACOS", claimed: false, color: "bg-yellow-50", location: "Lincoln Road Mall" },
];

// Mock Heatmap Data points (Real Miami Coordinates)
// Center roughly 25.774, -80.193
const MIAMI_LAT = 25.774;
const MIAMI_LNG = -80.133; // South Beachish

export const MOCK_HEAT_POINTS = Array.from({ length: 40 }, () => ({
  lat: MIAMI_LAT + (Math.random() - 0.5) * 0.04,
  lng: MIAMI_LNG + (Math.random() - 0.5) * 0.04,
  intensity: Math.floor(Math.random() * 10) + 1,
}));

// Feature Flags
// Show debug tools in development and staging, but not in production
export const ENABLE_DEBUG_TOOLS = !import.meta.env.PROD;

// Stripe Price IDs
// Replace these with your actual Stripe Price IDs from the Stripe Dashboard
// Get them from: Products > [Your Product] > Pricing
export const STRIPE_PRICE_IDS = {
  ONE_TIME: import.meta.env.VITE_STRIPE_PRICE_ID_ONE_TIME || 'price_placeholder_onetime', // $5 one-time check
  YEARLY: import.meta.env.VITE_STRIPE_PRICE_ID_YEARLY || 'price_placeholder_yearly', // $14.99 yearly unlimited
};