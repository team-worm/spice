import { MdSnackBar } from "@angular/material";
import { Response } from "@angular/http";
export function displaySnackbarError(snackBar: MdSnackBar, cause: string, error: any) {
	let errorMessage = '';
	if(error instanceof Error) {
		errorMessage = error.message;
	}
	else if(error instanceof Response) {
		if(error.status === 0) {
			errorMessage = 'No response from server';
		}
		else {
			errorMessage = `${error.status} ${error.statusText} (${error.text()})`;
		}
	} else {
		//just cast to string and hope it displays something meaningful
		errorMessage = '' + error;
	}
	console.error(cause, error);
	snackBar.open(`${cause}: ${errorMessage}`, undefined, {
		duration: 3000
	});
}
