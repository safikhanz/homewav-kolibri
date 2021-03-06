import has from 'lodash/has';
import {
  NetworkLocationResource,
  RemoteChannelResource,
  StaticNetworkLocationResource,
  DynamicNetworkLocationResource,
} from 'kolibri.resources';

import commonSyncElements from 'kolibri.coreVue.mixins.commonSyncElements';

function channelIsAvailableAtLocation(channelId, location) {
  if (!location.available) {
    return Promise.resolve(false);
  }
  return RemoteChannelResource.fetchModel({
    id: channelId,
    getParams: {
      baseurl: location.base_url,
    },
    force: true,
  })
    .then(() => {
      return true;
    })
    .catch(() => {
      return false;
    });
}

function versionCompare(version) {
  //check if version is >= 0.15.0
  const v = version.split('.');
  if (v.length < 2) return false;
  const mayor = parseInt(v[0]);
  const minor = parseInt(v[1]);
  if (!(!isNaN(mayor) && !isNaN(minor))) return false;
  if (mayor > 0) return true;
  if (minor >= 15) return true;
  return false;
}

function fetchAddressesForLOD(LocationResource = NetworkLocationResource) {
  return LocationResource.fetchCollection({ force: true }).then(locations => {
    return locations.filter(
      location => !location['subset_of_users_device'] && versionCompare(location.kolibri_version)
    );
  });
}

function fetchAddressesWithChannel(withChannelId = '', LocationResource = NetworkLocationResource) {
  return LocationResource.fetchCollection({ force: true }).then(locations => {
    // If channelId is provided, then we are in an 'import-more' workflow and disable
    // locations that do not have the channel we are importing from.
    if (withChannelId !== '') {
      const locationsWithAvailabilityPromises = locations.map(location => {
        // Need to wrap in normal promise, otherwise Promise.all will cause some of these
        // to resolve as undefined
        return new Promise(resolve => {
          return channelIsAvailableAtLocation(withChannelId, location).then(isAvailable => {
            resolve({ ...location, hasContent: isAvailable });
          });
        });
      });
      return Promise.all(locationsWithAvailabilityPromises);
    }

    // If channelId is not provided, then we are at top-level import workflow and do not
    // disable any locations unless it is unavailable
    return locations.map(location => ({ ...location, hasContent: location.available }));
  });
}

function facilityIsAvailableAtLocation(facilityId, location) {
  if (!location.available) {
    return Promise.resolve(false);
  }

  return commonSyncElements.methods
    .fetchNetworkLocationFacilities(location.id)
    .then(({ facilities }) => {
      return Boolean(facilities.find(({ id }) => id === facilityId));
    });
}

function fetchAddressesWithFacility(facilityId = '', LocationResource = NetworkLocationResource) {
  return LocationResource.fetchCollection({
    force: true,
    getParams: { subset_of_users_device: false },
  }).then(locations => {
    if (facilityId !== '') {
      const locationsWithAvailabilityPromises = locations.map(location => {
        // Need to wrap in normal promise, otherwise Promise.all will cause some of these
        // to resolve as undefined
        return new Promise(resolve => {
          return facilityIsAvailableAtLocation(facilityId, location).then(isAvailable => {
            // NOTE: we're reusing 'hasContent' for both the facility/content cases for now
            resolve({ ...location, hasContent: isAvailable });
          });
        });
      });
      return Promise.all(locationsWithAvailabilityPromises);
    }

    // If facilityId is not provided, then we are at the initial Facility Import workflow
    // disable any locations unless it is unavailable/offline
    return locations.map(location => ({ ...location, hasContent: location.available }));
  });
}

export function fetchStaticAddresses(args) {
  if (has(args, 'channelId')) {
    return fetchAddressesWithChannel(args.channelId, StaticNetworkLocationResource);
  } else if (has(args, 'facilityId')) {
    return fetchAddressesWithFacility(args.facilityId, StaticNetworkLocationResource);
  } else if (has(args, 'lod')) {
    return []; // Only devices discovered in the local network can be used
  } else {
    // As a default, just show any online location
    return fetchAddressesWithFacility('', StaticNetworkLocationResource);
  }
}

export function fetchDynamicAddresses(args) {
  if (has(args, 'channelId')) {
    return fetchAddressesWithChannel(args.channelId, DynamicNetworkLocationResource);
  } else if (has(args, 'facilityId')) {
    return fetchAddressesWithFacility(args.facilityId, DynamicNetworkLocationResource);
  } else if (has(args, 'lod')) {
    return fetchAddressesForLOD(DynamicNetworkLocationResource);
  } else {
    // As a default, just show any online location
    return fetchAddressesWithFacility('', DynamicNetworkLocationResource);
  }
}

// TODO replace with createStaticNetworkLocation in commonSyncElements in component
export function createAddress(address) {
  return commonSyncElements.methods.createStaticNetworkLocation({
    base_url: address.base_url,
    device_name: address.nickname,
  });
}

export function deleteAddress(id) {
  return StaticNetworkLocationResource.deleteModel({ id });
}
