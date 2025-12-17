import { createClient } from '@supabase/supabase-js';
import { LicensePlateReport, Badge, Deal } from '../types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Initialize Supabase client
export const supabase = SUPABASE_URL && SUPABASE_ANON_KEY
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

// Get or create device ID (for anonymous users)
export const getDeviceId = (): string => {
  let deviceId = localStorage.getItem('pettypatrol_device_id');
  if (!deviceId) {
    deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('pettypatrol_device_id', deviceId);
  }
  return deviceId;
};

// Save report to Supabase
export const saveReportToSupabase = async (report: LicensePlateReport): Promise<void> => {
  if (!supabase) {
    console.warn('Supabase not configured - skipping save');
    return;
  }

  try {
    const deviceId = getDeviceId();
    
    const { error } = await supabase
      .from('reports')
      .insert({
        id: report.id,
        device_id: deviceId,
        plate_text: report.plateText,
        behaviors: report.behaviors,
        custom_note: report.customNote || null,
        timestamp: new Date(report.timestamp).toISOString(),
        location: report.location || null,
        latitude: report.coordinates?.lat || null,
        longitude: report.coordinates?.lng || null,
      });

    if (error) {
      console.error('Error saving report to Supabase:', error);
    }
  } catch (error) {
    console.error('Error saving report to Supabase:', error);
  }
};

// Save badge unlock to Supabase
export const saveBadgeToSupabase = async (badge: Badge): Promise<void> => {
  if (!supabase) {
    console.warn('Supabase not configured - skipping save');
    return;
  }

  try {
    const deviceId = getDeviceId();
    
    const { error } = await supabase
      .from('badges')
      .insert({
        device_id: deviceId,
        badge_id: badge.id,
        badge_name: badge.name,
        unlocked_at: new Date().toISOString(),
      });

    if (error) {
      console.error('Error saving badge to Supabase:', error);
    }
  } catch (error) {
    console.error('Error saving badge to Supabase:', error);
  }
};

// Save deal claim to Supabase
export const saveDealClaimToSupabase = async (deal: Deal): Promise<void> => {
  if (!supabase) {
    console.warn('Supabase not configured - skipping save');
    return;
  }

  try {
    const deviceId = getDeviceId();
    
    const { error } = await supabase
      .from('deals')
      .insert({
        device_id: deviceId,
        deal_id: deal.id,
        partner_name: deal.partnerName,
        offer: deal.offer,
        qr_code_id: deal.qrCodeId,
        claimed_at: new Date().toISOString(),
      });

    if (error) {
      console.error('Error saving deal claim to Supabase:', error);
    }
  } catch (error) {
    console.error('Error saving deal claim to Supabase:', error);
  }
};

// Save beta tester info to Supabase
export const saveBetaTesterToSupabase = async (name?: string, email?: string): Promise<void> => {
  if (!supabase) {
    console.warn('Supabase not configured - skipping save');
    return;
  }

  // Only save if at least one field is provided
  if (!name && !email) {
    return;
  }

  try {
    const deviceId = getDeviceId();
    
    const { error } = await supabase
      .from('beta_testers')
      .upsert(
        {
          device_id: deviceId,
          name: name || null,
          email: email || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'device_id' }
      );

    if (error) {
      console.error('Error saving beta tester to Supabase:', error);
    }
  } catch (error) {
    console.error('Error saving beta tester to Supabase:', error);
  }
};


