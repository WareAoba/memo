import { tr } from '../../i18n';
export const textFields = () =>
  [
    ['name', tr('design-reference.workName'), 200],
    ['reference_code', tr('fields.referenceId'), 100],
    ['address', tr('fields.location'), 500],
    ['contact_name', tr('fields.relatedPerson'), 200],
    ['contact_info', tr('design-reference.contactDetails'), 500],
    ['access_instructions', tr('Picker.accessInstructions'), 5000],
    ['parking_info', tr('fields.parkingAndDeliveryInformation'), 5000],
    ['special_notes', tr('fields.specialContractNotes'), 5000],
    ['general_notes', tr('fields.descriptionAndNotes'), 5000],
  ] as const;
